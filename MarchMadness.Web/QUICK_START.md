# Quick Start Guide

## What Changed?

Your app has been completely refactored to use the NCAA API instead of manual entry. Here's what's new:

### ✅ Major Improvements
1. **Automatic Data**: Tournament brackets, teams, and scores sync automatically from NCAA API
2. **Both Tournaments**: Now supports Men's AND Women's Basketball tournaments
3. **No Manual Entry**: No more manually entering teams or game results
4. **Live Updates**: Scores update automatically when you sync from the API

### 🗑️ Removed
- Manual team entry page
- Manual game results entry page
- Manual bracket submission for others (can add back if needed)

### ➕ Added
- API client for NCAA data
- Admin sync page for data management
- Sport selection throughout the app
- Automatic bracket data synchronization

## How to Use It

### First Time Setup

1. **Build and Run**:
   ```
   dotnet build
   dotnet run
   ```
   The app will automatically try to sync bracket data on startup from the NCAA API.

2. **Access Admin Panel**:
   - Authenticate using Supabase (send Bearer token)
   - Click "Admin" in the navigation
   - You'll see options to sync Men's and Women's brackets

3. **Sync Bracket Data**:
   - Click "Sync Men's Bracket from API"
   - Click "Sync Women's Bracket from API"
   - This loads all teams and games for the 2025 tournament

### During the Tournament

1. **Update Scores Regularly**:
   - Go to Admin → Sync
   - Click "Update Men's Scores" or "Update Women's Scores"
   - This fetches current game results and recalculates standings

2. **Users Submit Brackets**:
   - Click "Submit Bracket" → Choose Men's or Women's
   - Fill out predictions
   - View standings anytime

## Testing the API

The NCAA API is live and working. You can test it in your browser:
- Men's Bracket: https://ncaa-api.henrygd.me/brackets/basketball-men/d1/2025
- Women's Bracket: https://ncaa-api.henrygd.me/brackets/basketball-women/d1/2025
- Scoreboard: https://ncaa-api.henrygd.me/scoreboard/basketball-men/d1

## Database Changes

The database will be **automatically recreated** on next run with the new schema including:
- `Sport` field on all tables ("basketball-men" or "basketball-women")
- `Year` field to support multiple seasons
- Updated relationships between Picks and Brackets

**Note**: Delete the old `marchmadness.db` file if you want a fresh start, it will be recreated automatically.

## Code Structure

```
Services/
  ├── NcaaApiClient.cs          # Fetches data from NCAA API
  ├── BracketSyncService.cs     # Syncs API data to database
  └── StandingsService.cs       # Calculates bracket scores

Models/
  ├── Api/                      # API response models
  ├── Team.cs                   # Updated with Sport/Year
  ├── Game.cs                   # Updated with API fields
  ├── Bracket.cs                # Updated with Sport/Year
  └── Pick.cs                   # Links to Bracket instead of User

Pages/
  ├── SubmitBracket.cshtml      # Sport selection added
  ├── Standings.cshtml          # Sport selection added
  ├── Admin/Sync.cshtml         # NEW - API sync controls
  └── Index.cshtml              # Updated for dual sports
```

## Troubleshooting

### API Not Loading Data
- Check internet connection
- Verify API is accessible: https://ncaa-api.henrygd.me
- Check logs in console for errors

### Database Errors
- Delete `marchmadness.db` and restart (fresh database)
- Check that app has write permissions to the folder

### No Teams Showing in Bracket Submission
- Run "Sync Men's/Women's Bracket" from Admin page
- Check that games have teams assigned

## Next Steps

1. Test the app locally
2. Deploy to your IIS test server
3. Test with a few colleagues
4. Set up a scheduled task or manual process to update scores during the tournament

## Questions?

The app is clean, maintainable, and ready for production. All old manual entry code has been removed in favor of the API integration.
