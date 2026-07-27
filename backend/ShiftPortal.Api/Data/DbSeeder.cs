using Microsoft.EntityFrameworkCore;
using ShiftPortal.Api.Models;

namespace ShiftPortal.Api.Data;

public static class DbSeeder
{
    private const string InitialAdminEmail = "admin@shiftportal.local";
    private const string InitialAdminTempPassword = "ChangeMe123!";

    public static async Task SeedAsync(ShiftPortalDbContext db, ILogger logger)
    {
        await db.Database.MigrateAsync();

        if (await db.Users.AnyAsync())
        {
            return;
        }

        var admin = new User
        {
            Id = Guid.NewGuid(),
            FullName = "Admin",
            Email = InitialAdminEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(InitialAdminTempPassword),
            Role = UserRole.Admin,
            MustChangePassword = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            CreatedByUserId = null
        };

        db.Users.Add(admin);
        await db.SaveChangesAsync();

        logger.LogWarning(
            "Seeded initial admin account. Email: {Email} | Temp password: {Password} (must be changed on first login)",
            InitialAdminEmail, InitialAdminTempPassword);
    }
}
