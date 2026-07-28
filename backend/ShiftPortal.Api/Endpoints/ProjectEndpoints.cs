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

            // Side-by-side column groups (OutSystems vs. Pro Code) instead of an interleaved
            // "Side" column — personas are shared across both sides (see the Add/Edit form),
            // so one row per persona × environment name reads far cleaner than one row per
            // raw credential with a side label repeated down a single column.
            string[] headers =
            [
                "Project Name", "Persona", "Environment",
                "OutSystems URL", "OutSystems Username", "OutSystems Password",
                "Pro Code URL", "Pro Code Username", "Pro Code Password",
            ];
            var outSystemsFill = XLColor.FromHtml("#E2E8F0");
            var proCodeFill = XLColor.FromHtml("#E0E7FF");
            for (var i = 0; i < headers.Length; i++)
            {
                var cell = sheet.Cell(1, i + 1);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                if (i is 3 or 4 or 5) cell.Style.Fill.BackgroundColor = outSystemsFill;
                else if (i is 6 or 7 or 8) cell.Style.Fill.BackgroundColor = proCodeFill;
            }

            var row = 2;
            foreach (var project in projects.OrderBy(p => p.Name))
            {
                var outEnvs = project.Environments.Where(e => e.Side == EnvironmentSide.OutSystems).OrderBy(e => e.SortOrder).ToList();
                var proEnvs = project.Environments.Where(e => e.Side == EnvironmentSide.NewApp).OrderBy(e => e.SortOrder).ToList();

                if (outEnvs.Count == 0 && proEnvs.Count == 0)
                {
                    sheet.Cell(row, 1).Value = project.Name;
                    row++;
                    continue;
                }

                var outByName = new Dictionary<string, ProjectEnvironment>(StringComparer.OrdinalIgnoreCase);
                foreach (var e in outEnvs) outByName[e.Name] = e;
                var proByName = new Dictionary<string, ProjectEnvironment>(StringComparer.OrdinalIgnoreCase);
                foreach (var e in proEnvs) proByName[e.Name] = e;

                var envNames = outEnvs.Select(e => e.Name)
                    .Concat(proEnvs.Select(e => e.Name))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                var personas = project.Environments
                    .SelectMany(e => e.Credentials.Select(c => c.RoleLabel))
                    .Distinct()
                    .ToList();

                // No credentials recorded anywhere yet: still list each environment's URL.
                if (personas.Count == 0)
                {
                    foreach (var envName in envNames)
                    {
                        sheet.Cell(row, 1).Value = project.Name;
                        sheet.Cell(row, 3).Value = envName;
                        if (outByName.TryGetValue(envName, out var oEnv)) sheet.Cell(row, 4).Value = oEnv.Url;
                        if (proByName.TryGetValue(envName, out var pEnv)) sheet.Cell(row, 7).Value = pEnv.Url;
                        row++;
                    }
                    continue;
                }

                foreach (var persona in personas)
                {
                    foreach (var envName in envNames)
                    {
                        sheet.Cell(row, 1).Value = project.Name;
                        sheet.Cell(row, 2).Value = persona;
                        sheet.Cell(row, 3).Value = envName;

                        if (outByName.TryGetValue(envName, out var oEnv))
                        {
                            sheet.Cell(row, 4).Value = oEnv.Url;
                            var oCred = oEnv.Credentials.FirstOrDefault(c => c.RoleLabel == persona);
                            if (oCred is not null)
                            {
                                sheet.Cell(row, 5).Value = oCred.Username;
                                sheet.Cell(row, 6).Value = encryption.Decrypt(oCred.PasswordEncrypted);
                            }
                        }
                        if (proByName.TryGetValue(envName, out var pEnv))
                        {
                            sheet.Cell(row, 7).Value = pEnv.Url;
                            var pCred = pEnv.Credentials.FirstOrDefault(c => c.RoleLabel == persona);
                            if (pCred is not null)
                            {
                                sheet.Cell(row, 8).Value = pCred.Username;
                                sheet.Cell(row, 9).Value = encryption.Decrypt(pCred.PasswordEncrypted);
                            }
                        }
                        row++;
                    }
                }
            }

            sheet.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);

            var fileName = $"legacy2next-projects-{DateTime.UtcNow:yyyy-MM-dd}.xlsx";
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
