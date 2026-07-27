using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ShiftPortal.Api.Data;
using ShiftPortal.Api.Dtos;
using ShiftPortal.Api.Models;
using ShiftPortal.Api.Services;

namespace ShiftPortal.Api.Endpoints;

public static class UserEndpoints
{
    public static void MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users").RequireAuthorization("AdminOnly");

        group.MapGet("/", async (ShiftPortalDbContext db) =>
        {
            var users = await db.Users
                .OrderBy(u => u.CreatedAt)
                .Select(u => ToSummary(u))
                .ToListAsync();

            return Results.Ok(users);
        });

        group.MapPost("/", async (CreateUserRequest request, ClaimsPrincipal principal, ShiftPortalDbContext db) =>
        {
            var currentUser = await AuthEndpoints.GetCurrentUserAsync(principal, db);
            if (currentUser is null)
            {
                return Results.Unauthorized();
            }

            var fullName = request.FullName.Trim();
            var email = request.Email.Trim().ToLowerInvariant();

            if (string.IsNullOrWhiteSpace(fullName) || string.IsNullOrWhiteSpace(email))
            {
                return Results.BadRequest(new { message = "Full name and email are required." });
            }

            if (!Enum.TryParse<UserRole>(request.Role, ignoreCase: true, out var role))
            {
                return Results.BadRequest(new { message = "Role must be Admin or Viewer." });
            }

            if (await db.Users.AnyAsync(u => u.Email.ToLower() == email))
            {
                return Results.Conflict(new { message = "A user with this email already exists." });
            }

            var tempPassword = TemporaryPasswordGenerator.Generate();

            var user = new User
            {
                Id = Guid.NewGuid(),
                FullName = fullName,
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(tempPassword),
                Role = role,
                MustChangePassword = true,
                IsActive = true,
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = currentUser.Id
            };

            db.Users.Add(user);
            await db.SaveChangesAsync();

            return Results.Created($"/api/users/{user.Id}", new CreateUserResponse(ToSummary(user), tempPassword));
        });

        group.MapPut("/{id:guid}/role", async (Guid id, UpdateUserRoleRequest request, ClaimsPrincipal principal, ShiftPortalDbContext db) =>
        {
            var currentUser = await AuthEndpoints.GetCurrentUserAsync(principal, db);
            if (currentUser is null)
            {
                return Results.Unauthorized();
            }

            if (id == currentUser.Id)
            {
                return Results.BadRequest(new { message = "You cannot change your own role. Ask another Admin." });
            }

            if (!Enum.TryParse<UserRole>(request.Role, ignoreCase: true, out var role))
            {
                return Results.BadRequest(new { message = "Role must be Admin or Viewer." });
            }

            var user = await db.Users.FindAsync(id);
            if (user is null)
            {
                return Results.NotFound();
            }

            user.Role = role;
            await db.SaveChangesAsync();

            return Results.Ok(ToSummary(user));
        });
    }

    private static UserSummaryDto ToSummary(User u) => new(
        u.Id, u.FullName, u.Email, u.Role.ToString(), u.MustChangePassword, u.IsActive, u.CreatedAt, u.LastLoginAt);
}
