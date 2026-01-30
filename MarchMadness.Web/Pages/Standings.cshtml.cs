using Microsoft.AspNetCore.Mvc.RazorPages;
using MarchMadness.Web.Services;

namespace MarchMadness.Web.Pages
{
    public class StandingsModel : PageModel
    {
        private readonly StandingsService _standingsService;

        public StandingsModel(StandingsService standingsService)
        {
            _standingsService = standingsService;
        }

        public List<BracketStanding> Standings { get; set; } = new();
        public string Sport { get; set; } = "basketball-men";

        public async Task OnGetAsync(string sport = "basketball-men")
        {
            try
            {
                Sport = sport;
                Standings = await _standingsService.GetStandingsAsync(sport, 2025);
            }
            catch (Exception ex)
            {
                Console.WriteLine("An error occured getting standings", ex);
            }
        }
    }
}
