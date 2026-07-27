using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ShiftPortal.Api.Data;
using ShiftPortal.Api.Dtos;
using ShiftPortal.Api.Services;

namespace ShiftPortal.Api.Endpoints;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapPost("/login", async (LoginRequest request, ShiftPortalDbContext db, TokenService tokenService) =>
        {
            var email = request.Email.Trim().ToLowerInvariant();
            var user = await db.Users.SingleOrDefaultAsync(u => u.Email.ToLower() == email);

            if (user is null || !user.IsActive || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                return Results.Unauthorized();
            }

            user.LastLoginAt = DateTime.UtcNow;
            await db.SaveChangesAsync();

            var token = tokenService.GenerateToken(user);
            return Results.Ok(new LoginResponse(token, ToMeResponse(user)));
        }).AllowAnonymous();

        group.MapGet("/me", async (ClaimsPrincipal principal, ShiftPortalDbContext db) =>
        {
            var user = await GetCurrentUserAsync(principal, db);
            return user is null ? Results.Unauthorized() : Results.Ok(ToMeResponse(user));
        }).RequireAuthorization();

        group.MapPost("/change-password", async (ChangePasswordRequest request, ClaimsPrincipal principal, ShiftPortalDbContext db, TokenService tokenService) =>
        {
            var user = await GetCurrentUserAsync(principal, db);
            if (user is null)
            {
                return Results.Unauthorized();
            }

            if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            {
                return Results.BadRequest(new { message = "Current password is incorrect." });
            }

            if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 8)
            {
                return Results.BadRequest(new { message = "New password must be at least 8 characters." });
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
            user.MustChangePassword = false;
            await db.SaveChangesAsync();

            var token = tokenService.GenerateToken(user);
            return Results.Ok(new ChangePasswordResponse(token, ToMeResponse(user)));
        }).RequireAuthorization();
    }

    internal static async Task<Models.User?> GetCurrentUserAsync(ClaimsPrincipal principal, ShiftPortalDbContext db)
    {
        var idClaim = principal.FindFirstValue(ClaimTypes.NameIdentifier)
                      ?? principal.FindFirstValue("sub");

        if (idClaim is null || !Guid.TryParse(idClaim, out var userId))
        {
            return null;
        }

        return await db.Users.FindAsync(userId);
    }

    internal static UserMeResponse ToMeResponse(Models.User user) => new(
        user.Id,
        user.FullName,
        user.Email,
        user.Role.ToString(),
        user.MustChangePassword,
        user.LastLoginAt);
}
