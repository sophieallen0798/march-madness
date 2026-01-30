using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.EntityFrameworkCore;
using MarchMadness.Web.Data;
using MarchMadness.Web.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddDbContext<MarchMadnessContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// Register HTTP client and API services
builder.Services.AddHttpClient<NcaaApiClient>();
builder.Services.AddScoped<BracketSyncService>();
builder.Services.AddScoped<StandingsService>();

builder.Services.AddAuthentication(NegotiateDefaults.AuthenticationScheme)
   .AddNegotiate();

builder.Services.AddAuthorization(options =>
{
    // By default, all incoming requests will be authorized according to the default policy.
    options.FallbackPolicy = options.DefaultPolicy;
    
    // Add admin policy
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
        db.Database.EnsureCreated();
        logger.LogInformation("Database initialized");

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

app.UseAuthorization();

app.MapRazorPages();

app.Run();
