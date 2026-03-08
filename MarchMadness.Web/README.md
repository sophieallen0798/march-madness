# March Madness Bracket App

An ASP.NET Core web application for running March Madness basketball bracket competitions with your company. Supports both Men's and Women's NCAA Basketball tournaments with automatic data synchronization from the NCAA API.

## Features

### For Users
- **Dual Tournament Support**: Submit brackets for both Men's and Women's Basketball
- **Easy Bracket Submission**: Pick winners for each game with a clean, intuitive interface
- **Live Standings**: Real-time leaderboard showing how your bracket compares to others
- **Automatic Scoring**: Points are automatically calculated as games complete (1, 2, 4, 8, 16, 32 points per round)
- **Authentication**: Uses Supabase JWT for authentication (see `appsettings.json` for admin configuration)

### For Administrators
- **API Integration**: Automatically syncs tournament data from NCAA API
- **One-Click Updates**: Update game scores and recalculate standings with a single click
- **No Manual Entry**: All team and game data comes directly from the NCAA

## Technical Stack

- **Framework**: ASP.NET Core 8.0 (Razor Pages)
- **Database**: SQLite (no separate SQL Server required)
- **Authentication**: Supabase JWT (Bearer tokens)
- **Data Source**: NCAA API (https://ncaa-api.henrygd.me)

## Setup Instructions

### Prerequisites
- .NET 8.0 SDK
- IIS with Windows Authentication enabled (for production)
- Network access to NCAA API

### Development
1. Clone the repository
2. Open `MarchMadness.Web.sln` in Visual Studio
3. Run the application (F5)
4. The database will be created automatically on first run
5. Bracket data will sync automatically from the API on startup

### Production
1. Install ASP.NET Core Hosting Bundle on the server
2. Create an IIS application pool (No Managed Code)
3. Ensure the app pool identity has write access to the application directory (for SQLite database)
4. Deploy the published application to IIS

### Admin Configuration
1. Update `appsettings.json` to add admin identifiers (Supabase `sub` values or emails):
    ```json
    "AdminUsers": [
       "sophieallen0798@gmail.com",
       "service-account-sub-guid"
    ]
    ```
2. Admins can access the Admin panel to:
   - Sync bracket data from the API
   - Update game scores
   - Recalculate standings

## Usage

### First Time Setup (Admin)
1. Navigate to Admin → Sync
2. Click "Sync Men's Bracket from API" to load men's tournament data
3. Click "Sync Women's Bracket from API" to load women's tournament data
4. Users can now submit their brackets

### During the Tournament (Admin)
1. Periodically click "Update Men's Scores" or "Update Women's Scores" to refresh game results
2. Standings are automatically recalculated when scores are updated

### For Employees
1. Navigate to "Submit Bracket"
2. Choose Men's or Women's Basketball
3. Fill out your predictions for all games
4. Submit your bracket
5. View standings to see how you're doing

## Database Schema

- **Teams**: Tournament teams with names, seeds, logos
- **Games**: Individual games with matchups, scores, winners
- **Users**: Employee information
- **Brackets**: User-submitted bracket entries
- **Picks**: Individual game predictions for each bracket

All data includes `Sport` and `Year` fields to support multiple tournaments.

## API Integration

The app uses the NCAA API (https://ncaa-api.henrygd.me) for:
- Bracket structure and team information
- Live game scores
- Tournament updates

Data is synced on:
- Application startup (initial load)
- Manual sync via Admin panel
- Score updates via Admin panel

## Troubleshooting

### "Tournament not set up yet"
- Admin needs to sync bracket data from the API
- Check network connectivity to the NCAA API

### Scores not updating
- Run "Update Scores" from the Admin panel
- Verify NCAA API is accessible

### Authentication issues
- Ensure Windows Authentication is enabled in IIS
- Check that users are in Active Directory
- Verify browser supports Windows Authentication

## Future Enhancements

Potential features for future versions:
- Automated score updates on a schedule
- Email notifications when standings change
- Bracket comparison views
- Historical tournament archives
- Mobile-responsive improvements

## License

Internal company use only.
