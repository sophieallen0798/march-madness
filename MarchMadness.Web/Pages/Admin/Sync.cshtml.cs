using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using MarchMadness.Web.Services;

namespace MarchMadness.Web.Pages.Admin
{
    [Authorize(Policy = "AdminOnly")]
    public class SyncModel : PageModel
    {
        private readonly BracketSyncService _syncService;
        private readonly StandingsService _standingsService;

        public SyncModel(BracketSyncService syncService, StandingsService standingsService)
        {
            _syncService = syncService;
            _standingsService = standingsService;
        }

        public string? Message { get; set; }
        public bool IsError { get; set; }

        public void OnGet()
        {
        }

        public async Task<IActionResult> OnPostSyncBracketsAsync(string sport)
        {
            try
            {
                await _syncService.SyncBracketDataAsync(sport, 2026);
                Message = $"Successfully synced {sport} bracket data from API";
                IsError = false;
            }
            catch (Exception ex)
            {
                Message = $"Error syncing bracket data: {ex.Message}";
                IsError = true;
            }

            return Page();
        }

        public async Task<IActionResult> OnPostUpdateScoresAsync(string sport)
        {
            try
            {
                await _syncService.UpdateScoresAsync(sport);
                await _standingsService.RecalculateBracketsForSportAsync(sport, 2026);
                Message = $"Successfully updated scores for {sport}";
                IsError = false;
            }
            catch (Exception ex)
            {
                Message = $"Error updating scores: {ex.Message}";
                IsError = true;
            }

            return Page();
        }

        public async Task<IActionResult> OnPostRecalculateStandingsAsync()
        {
            try
            {
                await _standingsService.RecalculateAllBracketsAsync();
                Message = "Successfully recalculated all standings";
                IsError = false;
            }
            catch (Exception ex)
            {
                Message = $"Error recalculating standings: {ex.Message}";
                IsError = true;
            }

            return Page();
        }
    }
}
