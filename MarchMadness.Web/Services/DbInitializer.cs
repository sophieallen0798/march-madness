using MarchMadness.Web.Data;
using MarchMadness.Web.Models;

namespace MarchMadness.Web.Services
{
    public static class DbInitializer
    {
        public static void Initialize(MarchMadnessContext context)
        {
            // Check if already initialized
            if (context.Teams.Any())
            {
                return;
            }

            // Create tournament structure with 64 teams (16 per region)
            var regions = new[] { "East", "West", "South", "Midwest" };
            
            // In a real scenario, you'd add actual teams here
            // For now, we'll just set up the game structure
            // Admin will add teams via the admin interface

            context.SaveChanges();
        }

        public static void CreateTournamentGames(MarchMadnessContext context)
        {
            if (context.Games.Any())
            {
                return;
            }

            var regions = new[] { "East", "West", "South", "Midwest" };
            int gameNumber = 1;

            // Round 1 - 32 games (8 per region)
            foreach (var region in regions)
            {
                for (int i = 0; i < 8; i++)
                {
                    context.Games.Add(new Game
                    {
                        Round = 1,
                        GameNumber = gameNumber++,
                        Region = region
                    });
                }
            }

            // Round 2 - 16 games (4 per region)
            foreach (var region in regions)
            {
                for (int i = 0; i < 4; i++)
                {
                    context.Games.Add(new Game
                    {
                        Round = 2,
                        GameNumber = gameNumber++,
                        Region = region
                    });
                }
            }

            // Round 3 (Sweet 16) - 8 games (2 per region)
            foreach (var region in regions)
            {
                for (int i = 0; i < 2; i++)
                {
                    context.Games.Add(new Game
                    {
                        Round = 3,
                        GameNumber = gameNumber++,
                        Region = region
                    });
                }
            }

            // Round 4 (Elite 8) - 4 games (1 per region)
            foreach (var region in regions)
            {
                context.Games.Add(new Game
                {
                    Round = 4,
                    GameNumber = gameNumber++,
                    Region = region
                });
            }

            // Round 5 (Final Four) - 2 games
            context.Games.Add(new Game { Round = 5, GameNumber = gameNumber++, Region = "Final Four" });
            context.Games.Add(new Game { Round = 5, GameNumber = gameNumber++, Region = "Final Four" });

            // Round 6 (Championship) - 1 game
            context.Games.Add(new Game { Round = 6, GameNumber = gameNumber++, Region = "Championship" });

            context.SaveChanges();
        }
    }
}
