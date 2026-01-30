using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using MarchMadness.Web.Data;
using MarchMadness.Web.Models;

namespace MarchMadness.Web.Pages.Admin
{
    [Authorize(Policy = "AdminOnly")]
    public class TeamsModel : PageModel
    {
        private readonly MarchMadnessContext _context;

        public TeamsModel(MarchMadnessContext context)
        {
            _context = context;
        }

        public List<Team> Teams { get; set; } = new();

        [BindProperty]
        public Team NewTeam { get; set; } = new();

        public async Task OnGetAsync()
        {
            Teams = await _context.Teams.OrderBy(t => t.Region).ThenBy(t => t.Seed).ToListAsync();
        }

        public async Task<IActionResult> OnPostAddTeamAsync()
        {
            if (!ModelState.IsValid)
            {
                Teams = await _context.Teams.OrderBy(t => t.Region).ThenBy(t => t.Seed).ToListAsync();
                return Page();
            }

            _context.Teams.Add(NewTeam);
            await _context.SaveChangesAsync();

            return RedirectToPage();
        }

        public async Task<IActionResult> OnPostDeleteTeamAsync(int id)
        {
            var team = await _context.Teams.FindAsync(id);
            if (team != null)
            {
                _context.Teams.Remove(team);
                await _context.SaveChangesAsync();
            }

            return RedirectToPage();
        }

        public async Task<IActionResult> OnPostAssignTeamsToGamesAsync()
        {
            // Auto-assign teams to Round 1 games based on region and seed
            var teams = await _context.Teams.Where(t => t.IsActive).OrderBy(t => t.Region).ThenBy(t => t.Seed).ToListAsync();
            var round1Games = await _context.Games.Where(g => g.Round == 1).OrderBy(g => g.Region).ThenBy(g => g.GameNumber).ToListAsync();

            // Group teams by region
            var teamsByRegion = teams.GroupBy(t => t.Region).ToDictionary(g => g.Key, g => g.ToList());

            foreach (var region in new[] { "East", "West", "South", "Midwest" })
            {
                if (!teamsByRegion.ContainsKey(region) || teamsByRegion[region].Count < 16)
                {
                    continue;
                }

                var regionTeams = teamsByRegion[region];
                var regionGames = round1Games.Where(g => g.Region == region).ToList();

                // Standard NCAA matchups: 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
                var matchups = new[] { (1, 16), (8, 9), (5, 12), (4, 13), (6, 11), (3, 14), (7, 10), (2, 15) };

                for (int i = 0; i < matchups.Length && i < regionGames.Count; i++)
                {
                    var game = regionGames[i];
                    var team1 = regionTeams.FirstOrDefault(t => t.Seed == matchups[i].Item1);
                    var team2 = regionTeams.FirstOrDefault(t => t.Seed == matchups[i].Item2);

                    if (team1 != null && team2 != null)
                    {
                        game.Team1Id = team1.Id;
                        game.Team2Id = team2.Id;
                    }
                }
            }

            await _context.SaveChangesAsync();
            TempData["Message"] = "Teams assigned to Round 1 games successfully!";

            return RedirectToPage();
        }
    }
}
