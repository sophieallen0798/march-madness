using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using MarchMadness.Web.Data;
using MarchMadness.Web.Models;
using MarchMadness.Web.Services;

namespace MarchMadness.Web.Pages.Admin
{
    [Authorize(Policy = "AdminOnly")]
    public class ResultsModel : PageModel
    {
        private readonly MarchMadnessContext _context;
        private readonly StandingsService _standingsService;

        public ResultsModel(MarchMadnessContext context, StandingsService standingsService)
        {
            _context = context;
            _standingsService = standingsService;
        }

        public List<Game> Games { get; set; } = new();
        public int SelectedRound { get; set; } = 1;

        public async Task OnGetAsync(int round = 1)
        {
            SelectedRound = round;
            Games = await _context.Games
                .Include(g => g.Team1)
                .Include(g => g.Team2)
                .Include(g => g.Winner)
                .Where(g => g.Round == round)
                .OrderBy(g => g.GameNumber)
                .ToListAsync();
        }

        public async Task<IActionResult> OnPostSetWinnerAsync(int gameId, int winnerId)
        {
            var game = await _context.Games.FindAsync(gameId);
            if (game == null)
            {
                return NotFound();
            }

            game.WinnerId = winnerId;
            await _context.SaveChangesAsync();

            // Advance winner to next round
            await AdvanceWinnerToNextRound(game, winnerId);

            // Recalculate standings
            await _standingsService.RecalculateAllBracketsAsync();

            return RedirectToPage(new { round = game.Round });
        }

        private async Task AdvanceWinnerToNextRound(Game completedGame, int winnerId)
        {
            if (completedGame.Round >= 6) // Championship game, no next round
            {
                return;
            }

            // Find the next game this winner should be in
            var nextRound = completedGame.Round + 1;
            var nextGames = await _context.Games
                .Where(g => g.Round == nextRound && g.Region == completedGame.Region)
                .OrderBy(g => g.GameNumber)
                .ToListAsync();

            if (nextGames.Any())
            {
                // Determine which game in the next round
                var gamesInCurrentRound = await _context.Games
                    .Where(g => g.Round == completedGame.Round && g.Region == completedGame.Region)
                    .OrderBy(g => g.GameNumber)
                    .ToListAsync();

                var gameIndex = gamesInCurrentRound.IndexOf(completedGame);
                var nextGameIndex = gameIndex / 2;

                if (nextGameIndex < nextGames.Count)
                {
                    var nextGame = nextGames[nextGameIndex];

                    // Assign to Team1 or Team2 slot
                    if (gameIndex % 2 == 0)
                    {
                        nextGame.Team1Id = winnerId;
                    }
                    else
                    {
                        nextGame.Team2Id = winnerId;
                    }

                    await _context.SaveChangesAsync();
                }
            }
        }
    }
}
