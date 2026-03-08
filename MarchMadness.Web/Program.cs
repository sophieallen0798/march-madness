using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MarchMadness.Web.Data;
using MarchMadness.Web.Models;
using MarchMadness.Web.Services;

// Npgsql 6+: opt in to the legacy timestamp behavior so DateTime values stored as
// "timestamp with time zone" are treated as UTC without requiring DateTimeOffset throughout.
AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddDbContext<MarchMadnessContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Register HTTP client and API services
builder.Services.AddHttpClient<NcaaApiClient>();
builder.Services.AddScoped<BracketSyncService>();
builder.Services.AddScoped<StandingsService>();
builder.Services.AddSingleton<ScoresUpdateTracker>();

// Use JWT Bearer authentication (Supabase)
builder.Services.AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.DefaultSignInScheme = CookieAuthenticationDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddCookie(options =>
    {
        options.LoginPath = "/Admin/Login";
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
    })
    .AddJwtBearer(options =>
    {
        // If a Supabase JWT secret is configured, validate signature using symmetric key.
        var jwtSecret = builder.Configuration["Supabase:JwtSecret"];
        if (!string.IsNullOrEmpty(jwtSecret))
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
            };
        }
        else
        {
            // Development fallback: accept tokens without signature validation
            options.RequireHttpsMetadata = false;
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateIssuerSigningKey = false
            };
        }
    });

// Register Supabase auth helper
builder.Services.AddScoped<SupabaseAuthService>();

builder.Services.AddRazorPages();

var app = builder.Build();

// Initialize database and sync bracket data
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MarchMadnessContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    
    try
    {
        Console.WriteLine("[diagnostic] Beginning DB.Migrate()");
        db.Database.Migrate();
        Console.WriteLine("[diagnostic] DB.Migrate() completed");
        logger.LogInformation("Database migrated/initialized");

        // Sync bracket data from API on startup
        var syncService = scope.ServiceProvider.GetRequiredService<BracketSyncService>();
        
        logger.LogInformation("Syncing Men's Basketball bracket data...");
        Console.WriteLine("[diagnostic] Starting SyncBracketDataAsync basketball-men");
        await syncService.SyncBracketDataAsync("basketball-men", 2025);
        Console.WriteLine("[diagnostic] Completed SyncBracketDataAsync basketball-men");
        
        logger.LogInformation("Syncing Women's Basketball bracket data...");
        Console.WriteLine("[diagnostic] Starting SyncBracketDataAsync basketball-women");
        await syncService.SyncBracketDataAsync("basketball-women", 2025);
        Console.WriteLine("[diagnostic] Completed SyncBracketDataAsync basketball-women");
        
        logger.LogInformation("Bracket data sync completed");
    }
    catch (Exception ex)
    {
        // Ensure exception details are visible on console during diagnostics
        Console.WriteLine("[diagnostic] Exception during startup initialization: " + ex.ToString());
        logger.LogError(ex, "Error during startup initialization");
    }
}

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

// Ensure authentication runs before authorization
app.UseAuthentication();
app.UseAuthorization();

// Minimal API: create or return current user tied to Supabase JWT sub
app.MapPost("/api/users", async (HttpContext http, MarchMadnessContext db) =>
{
    var sub = http.User.FindFirst("sub")?.Value;
    if (string.IsNullOrEmpty(sub))
        return Results.Unauthorized();

    var name = http.User.Identity?.Name ?? http.User.FindFirst("email")?.Value ?? "Supabase User";

    var user = await db.Users.FirstOrDefaultAsync(u => u.AuthUserId == sub);
    if (user == null)
    {
        user = new User { Name = name, AuthUserId = sub };
        db.Users.Add(user);
        await db.SaveChangesAsync();
    }

    return Results.Ok(new { id = user.Id, name = user.Name });
}).RequireAuthorization();

app.MapRazorPages();

// API to get last update timestamp for a sport
app.MapGet("/api/sync/lastupdated/{sport}", (string sport, ScoresUpdateTracker tracker) =>
{
    var dt = tracker.GetLastUpdatedUtc(sport);
    if (dt == null) return Results.NoContent();
    return Results.Ok(new { sport, lastUpdatedUtc = dt.Value.ToString("o") });
});

Console.WriteLine("[diagnostic] About to call app.Run()");
app.Run();
Console.WriteLine("[diagnostic] app.Run() returned");
