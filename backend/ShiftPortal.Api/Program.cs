using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ShiftPortal.Api.Data;
using ShiftPortal.Api.Endpoints;
using ShiftPortal.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<ShiftPortalDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

builder.Services.AddSingleton<TokenService>();

// Keys persist to local disk. If this ever runs as multiple instances/containers,
// this path must move to shared storage or credentials become undecryptable on failover.
var keyRingPath = Path.Combine(builder.Environment.ContentRootPath, "App_Data", "dataprotection-keys");
Directory.CreateDirectory(keyRingPath);
builder.Services.AddDataProtection()
    .SetApplicationName("ShiftPortal")
    .PersistKeysToFileSystem(new DirectoryInfo(keyRingPath));

builder.Services.AddSingleton<CredentialEncryptionService>();

var jwtSection = builder.Configuration.GetSection("Jwt");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSection["Issuer"],
            ValidAudience = jwtSection["Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSection["Key"]!))
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("AdminOnly", policy => policy.RequireRole("Admin"));

const string FrontendCorsPolicy = "FrontendDev";
builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ShiftPortalDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    await DbSeeder.SeedAsync(db, logger);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors(FrontendCorsPolicy);

app.UseAuthentication();

// Server-side enforcement of the forced first-login password change: an authenticated
// user whose account still has MustChangePassword set can only reach the handful of
// endpoints needed to check their own profile and change their password.
var mustChangePasswordAllowedPaths = new[] { "/api/auth/me", "/api/auth/change-password" };
app.Use(async (context, next) =>
{
    var path = context.Request.Path.Value ?? string.Empty;
    var isApiRequest = path.StartsWith("/api", StringComparison.OrdinalIgnoreCase);
    var isAllowed = mustChangePasswordAllowedPaths.Any(p => path.Equals(p, StringComparison.OrdinalIgnoreCase));

    if (isApiRequest && !isAllowed && context.User.Identity?.IsAuthenticated == true)
    {
        var mustChangePassword = context.User.FindFirst("mustChangePassword")?.Value == "true";
        if (mustChangePassword)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new { message = "Password change required before continuing." });
            return;
        }
    }

    await next();
});

app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }))
   .WithName("HealthCheck")
   .WithOpenApi();

app.MapAuthEndpoints();
app.MapUserEndpoints();
app.MapProjectEndpoints();

app.Run();
