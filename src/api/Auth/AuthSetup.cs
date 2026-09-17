using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Bis.Admin.Api.Data;
using Bis.Admin.Api.Models;
using Bis.Admin.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace Bis.Admin.Api.Auth;

public static class AuthSetup
{
    public const string AccessTokenScheme = "AccessToken";

    public static IServiceCollection AddAdminAuth(this IServiceCollection services, IConfiguration config)
    {
        var secret = config["AUTH_SECRET"] ?? config["Auth:Secret"]
            ?? throw new InvalidOperationException("AUTH_SECRET is required.");
        var keyBytes = Encoding.UTF8.GetBytes(secret);
        if (keyBytes.Length < 32)
        {
            var padded = new byte[32];
            Buffer.BlockCopy(keyBytes, 0, padded, 0, keyBytes.Length);
            keyBytes = padded;
        }
        var key = new SymmetricSecurityKey(keyBytes);

        services.AddSingleton(new JwtSettings(secret, key));
        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer(o =>
        {
            o.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromSeconds(30)
            };
            o.Events = new JwtBearerEvents
            {
                OnMessageReceived = ctx =>
                {
                    var header = ctx.Request.Headers.Authorization.ToString();
                    if (header.StartsWith("Bearer adm_ext_", StringComparison.Ordinal))
                        ctx.NoResult();
                    return Task.CompletedTask;
                }
            };
        });
        services.AddAuthorization(o =>
        {
            o.AddPolicy("Staff", p => p.RequireRole(Roles.Staff, Roles.Admin));
            o.AddPolicy("Admin", p => p.RequireRole(Roles.Admin));
            o.AddPolicy("AnyAuth", p => p.RequireAuthenticatedUser());
        });
        return services;
    }

    public static string IssueJwt(JwtSettings settings, User user, int minutes = 15)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim("sub", user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Name),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Role, user.Role)
        };
        var creds = new SigningCredentials(settings.Key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(minutes),
            signingCredentials: creds);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

public record JwtSettings(string Secret, SymmetricSecurityKey Key);

public class AccessTokenMiddleware
{
    private readonly RequestDelegate _next;

    public AccessTokenMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext ctx, AppDbContext db)
    {
        var header = ctx.Request.Headers.Authorization.ToString();
        if (header.StartsWith("Bearer adm_ext_", StringComparison.Ordinal))
        {
            var raw = header["Bearer ".Length..].Trim();
            var hash = TokenHash.Sha256(raw);
            var tok = await db.AccessTokens.AsNoTracking().FirstOrDefaultAsync(t => t.Hash == hash && t.Enabled);
            if (tok is null)
            {
                ctx.Response.StatusCode = 401;
                await ctx.Response.WriteAsJsonAsync(new { error = "Invalid access token" });
                return;
            }
            var identity = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, tok.Id.ToString()),
                new Claim(ClaimTypes.Name, tok.Name),
                new Claim(ClaimTypes.Role, Roles.Token),
                new Claim("token_id", tok.Id.ToString())
            }, "AccessToken");
            ctx.User = new ClaimsPrincipal(identity);
        }
        await _next(ctx);
    }
}

public static class Authz
{
    public static Actor Actor(HttpContext ctx) => Services.Actor.From(ctx.User);

    public static IResult? RequireStaff(HttpContext ctx)
    {
        var a = Actor(ctx);
        if (!ctx.User.Identity?.IsAuthenticated ?? true) return Results.Unauthorized();
        if (a.IsToken) return null;
        if (!a.IsStaff) return Results.Forbid();
        return null;
    }

    public static IResult? RequireHumanStaff(HttpContext ctx)
    {
        var a = Actor(ctx);
        if (!ctx.User.Identity?.IsAuthenticated ?? true) return Results.Unauthorized();
        if (a.IsToken) return Results.Json(new { error = "Access tokens are read-only and cannot mutate." }, statusCode: 403);
        if (!a.IsStaff) return Results.Forbid();
        return null;
    }

    public static IResult? RequireAdmin(HttpContext ctx)
    {
        var a = Actor(ctx);
        if (!ctx.User.Identity?.IsAuthenticated ?? true) return Results.Unauthorized();
        if (!a.IsAdmin) return Results.Json(new { error = "Admin only" }, statusCode: 403);
        return null;
    }

    public static IResult? RequireDashboardAdmin(HttpContext ctx)
    {
        var deny = RequireAdmin(ctx);
        if (deny is not null) return deny;
        if (Actor(ctx).IsToken) return Results.Json(new { error = "Access tokens cannot send shoutouts." }, statusCode: 403);
        return null;
    }

    public static IResult? DenyTokenForVaultOrAdmin(HttpContext ctx)
    {
        var a = Actor(ctx);
        if (a.IsToken) return Results.Json(new { error = "Access tokens cannot use vault or admin routes." }, statusCode: 403);
        return null;
    }
}
