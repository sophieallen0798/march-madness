using Microsoft.AspNetCore.Authentication.Negotiate;
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

// Use Windows negotiate authentication (original behavior)
builder.Services.AddAuthentication(NegotiateDefaults.AuthenticationScheme)
    .AddNegotiate();

builder.Services.AddAuthorization(options =>
{
    // By default, require authenticated users
    options.FallbackPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();

    // Admin policy: match against Windows username (original behavior)
    options.AddPolicy("AdminOnly", policy =>
    {
        var adminUsers = builder.Configuration.GetSection("AdminUsers").Get<string[]>() ?? Array.Empty<string>();
        policy.RequireAssertion(context =>
        {
            var username = context.User.Identity?.Name;
            return username != null && adminUsers.Contains(username, StringComparer.OrdinalIgnoreCase);
        });
    });
});

builder.Services.AddRazorPages();

var app = builder.Build();

// Initialize database and sync bracket data
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MarchMadnessContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    
    try
    {
        db.Database.Migrate();
        logger.LogInformation("Database migrated/initialized");

        // Sync bracket data from API on startup
        var syncService = scope.ServiceProvider.GetRequiredService<BracketSyncService>();
        
        logger.LogInformation("Syncing Men's Basketball bracket data...");
        await syncService.SyncBracketDataAsync("basketball-men", 2025);
        
        logger.LogInformation("Syncing Women's Basketball bracket data...");
        await syncService.SyncBracketDataAsync("basketball-women", 2025);
        
        logger.LogInformation("Bracket data sync completed");
    }
    catch (Exception ex)
    {
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

app.Run();
