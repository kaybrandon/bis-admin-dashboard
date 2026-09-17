using System.Text;
using Bis.Admin.Api.Api;
using Bis.Admin.Api.Auth;
using Bis.Admin.Api.Data;
using Bis.Admin.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

var dataDir = Path.Combine(builder.Environment.ContentRootPath, "data");
Directory.CreateDirectory(dataDir);

var cs = builder.Configuration.GetConnectionString("Default") ?? "Data Source=data/admin.db";
if (cs.StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase) && !Path.IsPathRooted(cs["Data Source=".Length..]))
{
    var file = cs["Data Source=".Length..].Trim();
    cs = "Data Source=" + Path.Combine(builder.Environment.ContentRootPath, file);
}

builder.Services.AddDbContext<AppDbContext>(o =>
{
    if (cs.Contains("Data Source=", StringComparison.OrdinalIgnoreCase) && !cs.Contains("Server=", StringComparison.OrdinalIgnoreCase))
        o.UseSqlite(cs);
    else
        o.UseSqlServer(cs);
});

builder.Services.AddAdminAuth(builder.Configuration);
builder.Services.AddSingleton<VaultCrypto>();
builder.Services.AddScoped<AuditWriter>();
builder.Services.AddScoped<MentionService>();
builder.Services.AddScoped<FileStore>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddApplicationInsightsTelemetry();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "BIS Admin API",
        Version = "v1",
        Description = "Staff Admin (never Folio). Home / Clients / Flags contracts for the Vite SPA in client/."
    });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT from POST /api/auth/login, or adm_ext_ access token",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = Array.Empty<string>()
    });
});

var spaOrigin = builder.Configuration["APP_BASE_URL"] ?? "http://localhost:5173";
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(spaOrigin, "http://localhost:5173", "http://127.0.0.1:5173")
        .AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "BIS Admin API v1");
    c.DocumentTitle = "Admin API";
});
app.UseCors();
app.Use(async (ctx, next) =>
{
    if (!ctx.Request.IsHttps && !app.Environment.IsDevelopment() &&
        !string.Equals(ctx.Request.Headers["X-Forwarded-Proto"], "https", StringComparison.OrdinalIgnoreCase))
    {
        ctx.Response.StatusCode = 400;
        await ctx.Response.WriteAsJsonAsync(new { error = "HTTPS only" });
        return;
    }
    await next();
});

app.UseAuthentication();
app.UseMiddleware<AccessTokenMiddleware>();
app.UseAuthorization();
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapAdminApi();
app.MapFallbackToFile("index.html");

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var vault = scope.ServiceProvider.GetRequiredService<VaultCrypto>();
    var log = scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("Seed");
    var pending = db.Database.GetPendingMigrations().ToList();
    var applied = db.Database.GetAppliedMigrations().ToList();
    if (pending.Count > 0 || applied.Count > 0)
        await db.Database.MigrateAsync();
    else
        await db.Database.EnsureCreatedAsync();
    await EnsurePostThumbsTableAsync(db);
    var files = scope.ServiceProvider.GetRequiredService<FileStore>();
    await SeedData.EnsureAsync(db, vault, app.Configuration, log, files);
}

if (args.Contains("--seed-only"))
    return;

app.Run();

static async Task EnsurePostThumbsTableAsync(AppDbContext db)
{
    if (!db.Database.IsSqlite()) return;
    await db.Database.ExecuteSqlRawAsync("""
        CREATE TABLE IF NOT EXISTS PostThumbs (
            Id TEXT NOT NULL PRIMARY KEY,
            PostId TEXT NOT NULL,
            UserId TEXT NOT NULL,
            CreatedAt TEXT NOT NULL
        );
        """);
    await db.Database.ExecuteSqlRawAsync("""
        CREATE UNIQUE INDEX IF NOT EXISTS IX_PostThumbs_PostId_UserId ON PostThumbs (PostId, UserId);
        """);
}

public partial class Program { }
