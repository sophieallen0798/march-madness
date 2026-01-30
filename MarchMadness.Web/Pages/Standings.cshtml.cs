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

        public async Task OnGetAsync()
        {
            Standings = await _standingsService.GetStandingsAsync();
        }
    }
}
