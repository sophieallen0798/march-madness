using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using MarchMadness.Web.Data;
using MarchMadness.Web.Models;

namespace MarchMadness.Web.Pages.Admin
{
    [Authorize(Policy = "AdminOnly")]
    public class SubmitForOthersModel : PageModel
    {
        private readonly MarchMadnessContext _context;

        public SubmitForOthersModel(MarchMadnessContext context)
        {
            _context = context;
        }

        [BindProperty]
        public string UserName { get; set; } = string.Empty;

        [BindProperty]
        public string BracketName { get; set; } = string.Empty;

        [BindProperty]
        public Dictionary<int, int> GamePicks { get; set; } = new();

        public List<Game> Round1Games { get; set; } = new();
        public List<Game> Round2Games { get; set; } = new();
        public List<Game> Round3Games { get; set; } = new();
        public List<Game> Round4Games { get; set; } = new();
        public List<Game> Round5Games { get; set; } = new();
        public List<Game> Round6Games { get; set; } = new();

        public async Task OnGetAsync()
        {
            await LoadGamesAsync();
        }

        public async Task<IActionResult> OnPostAsync()
        {
            if (string.IsNullOrWhiteSpace(UserName))
            {
                ModelState.AddModelError("UserName", "Please enter a name");
                await LoadGamesAsync();
                return Page();
            }

            var allGames = await _context.Games.CountAsync();
            if (GamePicks.Count != allGames)
            {
                ModelState.AddModelError("", "Please make a pick for every game");
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
                    WindowsUsername = $"Submitted by {User.Identity?.Name}"
                };
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }

            // Create bracket
            var bracket = new Bracket
            {
                UserId = user.Id,
                BracketName = string.IsNullOrWhiteSpace(BracketName) ? $"{UserName}'s Bracket" : BracketName,
                SubmittedDate = DateTime.Now
            };
            _context.Brackets.Add(bracket);
            await _context.SaveChangesAsync();

            // Delete existing picks for this user
            var existingPicks = await _context.Picks.Where(p => p.UserId == user.Id).ToListAsync();
            _context.Picks.RemoveRange(existingPicks);

            // Save picks
            foreach (var gamePick in GamePicks)
            {
                _context.Picks.Add(new Pick
                {
                    UserId = user.Id,
                    GameId = gamePick.Key,
                    PickedTeamId = gamePick.Value
                });
            }

            await _context.SaveChangesAsync();

            TempData["Message"] = $"Bracket submitted successfully for {UserName}!";
            return RedirectToPage();
        }

        private async Task LoadGamesAsync()
        {
            var allGames = await _context.Games
                .Include(g => g.Team1)
                .Include(g => g.Team2)
                .OrderBy(g => g.Round)
                .ThenBy(g => g.GameNumber)
                .ToListAsync();

            Round1Games = allGames.Where(g => g.Round == 1).ToList();
            Round2Games = allGames.Where(g => g.Round == 2).ToList();
            Round3Games = allGames.Where(g => g.Round == 3).ToList();
            Round4Games = allGames.Where(g => g.Round == 4).ToList();
            Round5Games = allGames.Where(g => g.Round == 5).ToList();
            Round6Games = allGames.Where(g => g.Round == 6).ToList();
        }
    }
}
