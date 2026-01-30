using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using MarchMadness.Web.Data;
using MarchMadness.Web.Models;

namespace MarchMadness.Web.Pages
{
    public class SubmitBracketModel : PageModel
    {
        private readonly MarchMadnessContext _context;

        public SubmitBracketModel(MarchMadnessContext context)
        {
            _context = context;
        }

        [BindProperty]
        public string UserName { get; set; } = string.Empty;

        [BindProperty]
        public string BracketName { get; set; } = string.Empty;

        [BindProperty]
        public string Sport { get; set; } = "basketball-men";

        [BindProperty]
        public Dictionary<int, int> GamePicks { get; set; } = new();

        public List<Game> AllGames { get; set; } = new();
        public Dictionary<int, List<Game>> GamesByRound { get; set; } = new();
        public bool HasGames { get; set; }

        public async Task OnGetAsync(string sport = "basketball-men")
        {
            Sport = sport;
            await LoadGamesAsync();
        }

        public async Task<IActionResult> OnPostAsync()
        {
            if (string.IsNullOrWhiteSpace(UserName))
            {
                ModelState.AddModelError("UserName", "Please enter your name");
                await LoadGamesAsync();
                return Page();
            }

            var expectedGameCount = await _context.Games
                .Where(g => g.Sport == Sport && g.Year == 2026 && g.Team1Id.HasValue && g.Team2Id.HasValue)
                .CountAsync();

            if (GamePicks.Count != expectedGameCount)
            {
                ModelState.AddModelError("", $"Please make a pick for all {expectedGameCount} games");
                await LoadGamesAsync();
                return Page();
            }

            // Get or create user
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Name == UserName);
            if (user == null)
            {
                user = new User
                {
                    Name = UserName,
                    WindowsUsername = User.Identity?.Name
                };
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }

            // Check if user already has a bracket for this sport/year
            var existingBracket = await _context.Brackets
                .FirstOrDefaultAsync(b => b.UserId == user.Id && b.Sport == Sport && b.Year == 2026);

            if (existingBracket != null)
            {
                // Delete existing picks
                var existingPicks = await _context.Picks.Where(p => p.BracketId == existingBracket.Id).ToListAsync();
                _context.Picks.RemoveRange(existingPicks);

                // Update bracket name if provided
                if (!string.IsNullOrWhiteSpace(BracketName))
                {
                    existingBracket.BracketName = BracketName;
                }
                existingBracket.SubmittedDate = DateTime.Now;
            }
            else
            {
                // Create new bracket
                existingBracket = new Bracket
                {
                    UserId = user.Id,
                    Sport = Sport,
                    Year = 2026,
                    BracketName = string.IsNullOrWhiteSpace(BracketName) ? $"{UserName}'s {(Sport == "basketball-men" ? "Men's" : "Women's")} Bracket" : BracketName,
                    SubmittedDate = DateTime.Now
                };
                _context.Brackets.Add(existingBracket);
                await _context.SaveChangesAsync();
            }

            // Save picks
            foreach (var gamePick in GamePicks)
            {
                _context.Picks.Add(new Pick
                {
                    BracketId = existingBracket.Id,
                    GameId = gamePick.Key,
                    PickedTeamId = gamePick.Value
                });
            }

            await _context.SaveChangesAsync();

            return RedirectToPage("/Standings", new { sport = Sport });
        }

        private async Task LoadGamesAsync()
        {
            AllGames = await _context.Games
                .Include(g => g.Team1)
                .Include(g => g.Team2)
                .Where(g => g.Sport == Sport && g.Year == 2026 && g.Team1Id.HasValue && g.Team2Id.HasValue)
                .OrderBy(g => g.Round)
                .ThenBy(g => g.BracketPositionId)
                .ToListAsync();

            GamesByRound = AllGames.GroupBy(g => g.Round).ToDictionary(g => g.Key, g => g.ToList());
            HasGames = AllGames.Any();
        }
    }
}
