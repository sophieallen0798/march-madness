using Microsoft.AspNetCore.Authentication.Negotiate;
using Microsoft.EntityFrameworkCore;
using MarchMadness.Web.Data;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddDbContext<MarchMadnessContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

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

builder.Services.AddScoped<MarchMadness.Web.Services.StandingsService>();
builder.Services.AddRazorPages();

var app = builder.Build();

// Initialize database
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MarchMadnessContext>();
    db.Database.EnsureCreated();
    MarchMadness.Web.Services.DbInitializer.Initialize(db);
    MarchMadness.Web.Services.DbInitializer.CreateTournamentGames(db);
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
