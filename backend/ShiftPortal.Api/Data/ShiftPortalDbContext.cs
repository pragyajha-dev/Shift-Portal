using Microsoft.EntityFrameworkCore;
using ShiftPortal.Api.Models;

namespace ShiftPortal.Api.Data;

public class ShiftPortalDbContext(DbContextOptions<ShiftPortalDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectEnvironment> Environments => Set<ProjectEnvironment>();
    public DbSet<Credential> Credentials => Set<Credential>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("Users");
            entity.HasKey(u => u.Id);
            entity.Property(u => u.FullName).IsRequired().HasMaxLength(200);
            entity.Property(u => u.Email).IsRequired().HasMaxLength(320);
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.Role).HasConversion<string>().HasMaxLength(20);

            entity.HasOne(u => u.CreatedByUser)
                  .WithMany()
                  .HasForeignKey(u => u.CreatedByUserId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Project>(entity =>
        {
            entity.ToTable("Projects");
            entity.HasKey(p => p.Id);
            entity.Property(p => p.Name).IsRequired().HasMaxLength(300);

            entity.HasOne(p => p.CreatedByUser)
                  .WithMany()
                  .HasForeignKey(p => p.CreatedByUserId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(p => p.UpdatedByUser)
                  .WithMany()
                  .HasForeignKey(p => p.UpdatedByUserId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ProjectEnvironment>(entity =>
        {
            entity.ToTable("Environments");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Url).IsRequired().HasMaxLength(2000);
            entity.Property(e => e.Side).HasConversion<string>().HasMaxLength(20);

            entity.HasOne(e => e.Project)
                  .WithMany(p => p.Environments)
                  .HasForeignKey(e => e.ProjectId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Credential>(entity =>
        {
            entity.ToTable("Credentials");
            entity.HasKey(c => c.Id);
            entity.Property(c => c.RoleLabel).IsRequired().HasMaxLength(200);
            entity.Property(c => c.Username).IsRequired().HasMaxLength(300);
            entity.Property(c => c.PasswordEncrypted).IsRequired();

            entity.HasOne(c => c.Environment)
                  .WithMany(e => e.Credentials)
                  .HasForeignKey(c => c.EnvironmentId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
