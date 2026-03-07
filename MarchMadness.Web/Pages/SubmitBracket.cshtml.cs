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
        public Dictionary<int, Dictionary<string, List<Game>>> GamesByRoundAndRegion { get; set; } = new();
        public List<Game> AllPossibleGames { get; set; } = new();
        public bool HasGames { get; set; }
        public bool IsNameVerified { get; set; } = false;
        public string? ErrorMessage { get; set; }

        public async Task OnGetAsync(string sport = "basketball-men")
        {
            Sport = sport;
            // Don't load games until name is verified
            IsNameVerified = false;
        }

        public async Task<IActionResult> OnPostVerifyNameAsync()
        {
            if (string.IsNullOrWhiteSpace(UserName))
            {
                ErrorMessage = "Please enter your name";
                return Page();
            }

            // Check if this name already has a bracket for this sport/year
            var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Name == UserName);
            if (existingUser != null)
            {
                var existingBracket = await _context.Brackets
                    .FirstOrDefaultAsync(b => b.UserId == existingUser.Id && b.Sport == Sport && b.Year == 2025);

                if (existingBracket != null)
                {
                    ErrorMessage = $"The name '{UserName}' already has a bracket for this tournament. Please choose a different name.";
                    return Page();
                }
            }

            // Name is available - load games and show bracket
            IsNameVerified = true;
            await LoadGamesAsync();
            return Page();
        }

        public async Task<IActionResult> OnPostSubmitBracketAsync()
        {
            if (string.IsNullOrWhiteSpace(UserName))
            {
                ErrorMessage = "Please enter your name";
                await LoadGamesAsync();
                IsNameVerified = true;
                return Page();
            }

            // Re-verify name hasn't been taken since initial verification
            var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.Name == UserName);
            if (existingUser != null)
            {
                var existingBracket = await _context.Brackets
                    .FirstOrDefaultAsync(b => b.UserId == existingUser.Id && b.Sport == Sport && b.Year == 2025);

                if (existingBracket != null)
                {
                    ErrorMessage = $"The name '{UserName}' already has a bracket. Please reload the page and use a different name.";
                    await LoadGamesAsync();
                    IsNameVerified = true;
                    return Page();
                }
            }

            var expectedGameCount = await _context.Games
                .Where(g => g.Sport == Sport && g.Year == 2025 && g.Round >= 2)
                .CountAsync();

            if (GamePicks.Count != expectedGameCount)
            {
                ErrorMessage = $"Please make a pick for all {expectedGameCount} games";
                await LoadGamesAsync();
                IsNameVerified = true;
                return Page();
            }

            // Create user (name was already verified as available)
            var user = new User
            {
                Name = UserName
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            // Create new bracket
            var newBracket = new Bracket
            {
                UserId = user.Id,
                Sport = Sport,
                Year = 2025,
                BracketName = string.IsNullOrWhiteSpace(BracketName) ? $"{UserName}'s {(Sport == "basketball-men" ? "Men's" : "Women's")} Bracket" : BracketName,
                SubmittedDate = DateTime.UtcNow
            };
            _context.Brackets.Add(newBracket);
            await _context.SaveChangesAsync();

            // Save picks
            foreach (var gamePick in GamePicks)
            {
                _context.Picks.Add(new Pick
                {
                    BracketId = newBracket.Id,
                    GameId = gamePick.Key,
                    PickedTeamId = gamePick.Value
                });
            }

            await _context.SaveChangesAsync();

            return RedirectToPage("/Standings", new { sport = Sport });
        }

        private async Task LoadGamesAsync()
        {
            try
            {
                // Load all games - Round 2 through Round 7 (excluding First Four play-in games)
                AllPossibleGames = await _context.Games
                    .Include(g => g.Team1)
                    .Include(g => g.Team2)
                    .Where(g => g.Sport == Sport && g.Year == 2025 && g.Round >= 2)
                    .OrderBy(g => g.Round)
                    .ThenBy(g => g.Region)
                    .ThenBy(g => g.BracketPositionId)
                    .ToListAsync();

                // Load only games with actual teams (Round 2 should have all 32 games with teams)
                AllGames = AllPossibleGames
                    .Where(g => g.Team1Id.HasValue && g.Team2Id.HasValue)
                    .ToList();

                // Group all games by Round, then by Region
                GamesByRoundAndRegion = AllPossibleGames
                    .GroupBy(g => g.Round)
                    .OrderBy(r => r.Key)
                    .ToDictionary(
                        roundGroup => roundGroup.Key,
                        roundGroup => roundGroup
                            .GroupBy(g => g.Region ?? "")
                            .OrderBy(r => r.Key)
                            .ToDictionary(
                                regionGroup => regionGroup.Key,
                                regionGroup => regionGroup.OrderBy(g => g.BracketPositionId).ToList()
                            )
                    );

                GamesByRound = AllPossibleGames.GroupBy(g => g.Round).ToDictionary(g => g.Key, g => g.ToList());
                HasGames = AllGames.Any();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error loading games: {ex.Message}");
            }
        }
    }
}
