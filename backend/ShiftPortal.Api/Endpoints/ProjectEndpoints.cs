using System.Security.Claims;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using ShiftPortal.Api.Data;
using ShiftPortal.Api.Dtos;
using ShiftPortal.Api.Models;
using ShiftPortal.Api.Services;

namespace ShiftPortal.Api.Endpoints;

public static class ProjectEndpoints
{
    public static void MapProjectEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/projects").RequireAuthorization();

        group.MapGet("/", async (string? search, int? page, string? sortDir, ShiftPortalDbContext db) =>
        {
            const int pageSize = 10;
            var currentPage = page is null or < 1 ? 1 : page.Value;

            var query = ApplySort(ApplyNameSearch(db.Projects.AsQueryable(), search), sortDir);

            var totalCount = await query.CountAsync();
            var items = await query
                .Skip((currentPage - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new ProjectSummaryDto(p.Id, p.Name, p.CreatedAt, p.UpdatedAt))
                .ToListAsync();

            return Results.Ok(new PagedResult<ProjectSummaryDto>(items, totalCount, currentPage, pageSize));
        });

        // Exports the full filtered list (not just the current page) with credential
        // passwords unmasked, per the PRD's explicit decision — Viewers can export too,
        // this is not Admin-only, matching their granted "export data" permission.
        group.MapGet("/export", async (string? search, string? sortDir, ShiftPortalDbContext db, CredentialEncryptionService encryption) =>
        {
            var query = ApplySort(ApplyNameSearch(db.Projects.AsQueryable(), search), sortDir);

            var projects = await query
                .Include(p => p.Environments)
                .ThenInclude(e => e.Credentials)
                .ToListAsync();

            using var workbook = new XLWorkbook();
            var sheet = workbook.Worksheets.Add("Projects");

            string[] headers = ["Project Name", "Side", "Environment", "URL", "Credential Role", "Username", "Password"];
            for (var i = 0; i < headers.Length; i++)
            {
                sheet.Cell(1, i + 1).Value = headers[i];
                sheet.Cell(1, i + 1).Style.Font.Bold = true;
            }

            var row = 2;
            foreach (var project in projects.OrderBy(p => p.Name))
            {
                if (project.Environments.Count == 0)
                {
                    sheet.Cell(row, 1).Value = project.Name;
                    row++;
                    continue;
                }

                foreach (var env in project.Environments.OrderBy(e => e.Side).ThenBy(e => e.SortOrder))
                {
                    if (env.Credentials.Count == 0)
                    {
                        sheet.Cell(row, 1).Value = project.Name;
                        sheet.Cell(row, 2).Value = env.Side.ToString();
                        sheet.Cell(row, 3).Value = env.Name;
                        sheet.Cell(row, 4).Value = env.Url;
                        row++;
                        continue;
                    }

                    foreach (var cred in env.Credentials.OrderBy(c => c.SortOrder))
                    {
                        sheet.Cell(row, 1).Value = project.Name;
                        sheet.Cell(row, 2).Value = env.Side.ToString();
                        sheet.Cell(row, 3).Value = env.Name;
                        sheet.Cell(row, 4).Value = env.Url;
                        sheet.Cell(row, 5).Value = cred.RoleLabel;
                        sheet.Cell(row, 6).Value = cred.Username;
                        sheet.Cell(row, 7).Value = encryption.Decrypt(cred.PasswordEncrypted);
                        row++;
                    }
                }
            }

            sheet.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);

            var fileName = $"shift-portal-projects-{DateTime.UtcNow:yyyy-MM-dd}.xlsx";
            return Results.File(
                stream.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileName);
        });

        group.MapGet("/{id:guid}", async (Guid id, ShiftPortalDbContext db, CredentialEncryptionService encryption) =>
        {
            var project = await db.Projects
                .Include(p => p.Environments)
                .ThenInclude(e => e.Credentials)
                .SingleOrDefaultAsync(p => p.Id == id);

            if (project is null)
            {
                return Results.NotFound();
            }

            return Results.Ok(ToDetailDto(project, encryption));
        });

        group.MapPost("/", async (SaveProjectRequest request, ClaimsPrincipal principal, ShiftPortalDbContext db, CredentialEncryptionService encryption) =>
        {
            var currentUser = await AuthEndpoints.GetCurrentUserAsync(principal, db);
            if (currentUser is null)
            {
                return Results.Unauthorized();
            }

            if (!TryValidate(request, out var validationError))
            {
                return Results.BadRequest(new { message = validationError });
            }

            var project = new Project
            {
                Id = Guid.NewGuid(),
                Name = request.Name.Trim(),
                CreatedByUserId = currentUser.Id,
                CreatedAt = DateTime.UtcNow,
                Environments = BuildEnvironments(request.Environments, encryption)
            };

            db.Projects.Add(project);
            await db.SaveChangesAsync();

            var saved = await db.Projects
                .Include(p => p.Environments)
                .ThenInclude(e => e.Credentials)
                .SingleAsync(p => p.Id == project.Id);

            return Results.Created($"/api/projects/{project.Id}", ToDetailDto(saved, encryption));
        }).RequireAuthorization("AdminOnly");

        group.MapPut("/{id:guid}", async (Guid id, SaveProjectRequest request, ClaimsPrincipal principal, ShiftPortalDbContext db, CredentialEncryptionService encryption) =>
        {
            var currentUser = await AuthEndpoints.GetCurrentUserAsync(principal, db);
            if (currentUser is null)
            {
                return Results.Unauthorized();
            }

            if (!TryValidate(request, out var validationError))
            {
                return Results.BadRequest(new { message = validationError });
            }

            var project = await db.Projects
                .Include(p => p.Environments)
                .ThenInclude(e => e.Credentials)
                .SingleOrDefaultAsync(p => p.Id == id);

            if (project is null)
            {
                return Results.NotFound();
            }

            // Editing replaces the whole nested Environment/Credential graph in one action,
            // matching the PRD's "Save persists the project along with all environments and
            // credentials ... in a single action" — avoids diffing add/remove rows from the form.
            // The delete is flushed before the insert (two SaveChanges in one transaction)
            // rather than Clear()-then-Add() on the same collection, which races EF's own
            // cascade-delete tracking against the database's ON DELETE CASCADE.
            await using var transaction = await db.Database.BeginTransactionAsync();

            db.Environments.RemoveRange(project.Environments);
            await db.SaveChangesAsync();

            project.Name = request.Name.Trim();
            project.UpdatedByUserId = currentUser.Id;
            project.UpdatedAt = DateTime.UtcNow;

            // These new entities carry client-generated (non-default) Guid keys, which makes
            // EF's DetectChanges-based fixup ambiguous about Added vs. Modified — even via
            // project.Environments.Add(...), it was generating UPDATE statements for rows that
            // don't exist yet. db.Environments.AddRange(...) marks them unambiguously Added.
            var newEnvironments = BuildEnvironments(request.Environments, encryption);
            foreach (var env in newEnvironments)
            {
                env.ProjectId = project.Id;
            }
            db.Environments.AddRange(newEnvironments);

            await db.SaveChangesAsync();
            await transaction.CommitAsync();

            var saved = await db.Projects
                .Include(p => p.Environments)
                .ThenInclude(e => e.Credentials)
                .SingleAsync(p => p.Id == project.Id);

            return Results.Ok(ToDetailDto(saved, encryption));
        }).RequireAuthorization("AdminOnly");

        group.MapDelete("/{id:guid}", async (Guid id, ShiftPortalDbContext db) =>
        {
            var project = await db.Projects.FindAsync(id);
            if (project is null)
            {
                return Results.NotFound();
            }

            db.Projects.Remove(project);
            await db.SaveChangesAsync();

            return Results.NoContent();
        }).RequireAuthorization("AdminOnly");
    }

    private static IQueryable<Project> ApplyNameSearch(IQueryable<Project> query, string? search)
    {
        if (string.IsNullOrWhiteSpace(search))
        {
            return query;
        }

        var term = search.Trim().ToLower();
        return query.Where(p => p.Name.ToLower().Contains(term));
    }

    private static IQueryable<Project> ApplySort(IQueryable<Project> query, string? sortDir) =>
        string.Equals(sortDir, "desc", StringComparison.OrdinalIgnoreCase)
            ? query.OrderByDescending(p => p.Name)
            : query.OrderBy(p => p.Name);

    private static bool TryValidate(SaveProjectRequest request, out string? error)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            error = "Project name is required.";
            return false;
        }

        foreach (var env in request.Environments)
        {
            if (!Enum.TryParse<EnvironmentSide>(env.Side, ignoreCase: true, out _))
            {
                error = $"Environment side must be OutSystems or NewApp (got '{env.Side}').";
                return false;
            }

            if (string.IsNullOrWhiteSpace(env.Name))
            {
                error = "Environment name is required.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(env.Url))
            {
                error = "Environment URL is required.";
                return false;
            }

            foreach (var cred in env.Credentials)
            {
                if (string.IsNullOrWhiteSpace(cred.RoleLabel) || string.IsNullOrWhiteSpace(cred.Username))
                {
                    error = "Credential role and username are required.";
                    return false;
                }
            }
        }

        error = null;
        return true;
    }

    private static List<ProjectEnvironment> BuildEnvironments(List<SaveEnvironmentRequest> requests, CredentialEncryptionService encryption)
    {
        var now = DateTime.UtcNow;
        return requests.Select(env => new ProjectEnvironment
        {
            Id = Guid.NewGuid(),
            Side = Enum.Parse<EnvironmentSide>(env.Side, ignoreCase: true),
            Name = env.Name.Trim(),
            Url = env.Url.Trim(),
            SortOrder = env.SortOrder,
            CreatedAt = now,
            Credentials = env.Credentials.Select(cred => new Credential
            {
                Id = Guid.NewGuid(),
                RoleLabel = cred.RoleLabel.Trim(),
                Username = cred.Username.Trim(),
                PasswordEncrypted = encryption.Encrypt(cred.Password ?? string.Empty),
                SortOrder = cred.SortOrder,
                CreatedAt = now
            }).ToList()
        }).ToList();
    }

    private static ProjectDetailDto ToDetailDto(Project project, CredentialEncryptionService encryption) => new(
        project.Id,
        project.Name,
        project.CreatedAt,
        project.UpdatedAt,
        project.Environments
            .OrderBy(e => e.SortOrder)
            .Select(e => new EnvironmentDto(
                e.Id,
                e.Side.ToString(),
                e.Name,
                e.Url,
                e.SortOrder,
                e.Credentials
                    .OrderBy(c => c.SortOrder)
                    .Select(c => new CredentialDto(c.Id, c.RoleLabel, c.Username, encryption.Decrypt(c.PasswordEncrypted), c.SortOrder))
                    .ToList()))
            .ToList());
}
