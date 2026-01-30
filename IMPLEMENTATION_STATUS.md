# March Madness Bracket App - Implementation Status

## Completed Items ✅

### 1. Round Number Parsing from BracketId
- **Status**: ✅ COMPLETE
- **Changes Made**:
  - Updated `Game` model to add `BracketId` and `VictorBracketPositionId` fields
  - Modified `BracketSyncService.cs` to parse round number from first digit of `bracketId` (e.g., 201 = round 2)
  - Created and applied EF Core migration `AddBracketIdAndVictorPosition`
  - Data successfully synced from API with correct round numbers

### 2. Database Schema Updates
- **Status**: ✅ COMPLETE
- **Migrations**:
  - `20260130191719_InitialCreate` - Initial database schema
  - `20260130195251_AddBracketIdAndVictorPosition` - Added BracketId and VictorBracketPositionId
- **Verified**: App running successfully on http://localhost:5139

## Remaining Work 🚧

### 3. First Four Handling
- **Status**: ❌ NOT STARTED
- **Requirements**:
  - Remove "First Four" as a separate display section
  - In Round 1, show play-in games as: "(Team A / Team B) vs Team C"
  - User doesn't pick First Four games separately - they're implicit in Round 1 picks
- **Implementation Needed**:
  - Modify `SubmitBracket.cshtml.cs` to filter out Round 1 games
  - Update display logic to show play-in scenarios
  - Backend: Track which Round 2 games depend on First Four results

### 4. Cascading Bracket Selection
- **Status**: ❌ NOT STARTED  
- **Requirements**:
  - When user picks a winner, automatically populate that team in the next round
  - JavaScript-based client-side cascading
  - Use `VictorBracketPositionId` to know where winner advances
- **Implementation Needed**:
  - JavaScript function to handle radio button changes
  - Map bracket positions to next-round games
  - Dynamically update team options in subsequent rounds
  - Handle clearing downstream selections when user changes earlier picks

### 5. Scrollable Bracket Visualization
- **Status**: ❌ NOT STARTED
- **Requirements**:
  - Horizontal scrollable layout (desktop-only, no mobile support needed)
  - Visual bracket tree structure instead of card columns
  - Display rounds side-by-side with connecting lines
- **Implementation Needed**:
  - Complete CSS rewrite for bracket visualization
  - Use flexbox with horizontal scroll
  - Add visual connectors between rounds
  - Position games vertically to align with advancing matchups

### 6. Validation with Error Highlighting
- **Status**: ❌ NOT STARTED
- **Requirements**:
  - Client-side validation before submit
  - Highlight unpicked games in red
  - Show error message if incomplete
  - Show confirmation dialog when complete
- **Implementation Needed**:
  - JavaScript validation function
  - CSS classes for error states (`.error`, red borders)
  - Check all non-TBD games have selections
  - Scroll to first error on validation failure

### 7. Unit Tests
- **Status**: ❌ NOT STARTED
- **Requirements**:
  - Test round number parsing logic
  - Test cascading bracket logic
  - Test bracket sync service
  - Test standings calculation
- **Implementation Needed**:
  - Create test project (xUnit recommended)
  - Write tests for `BracketSyncService`
  - Write tests for `StandingsService`
  - Write tests for cascading UI logic (possibly with Playwright/Selenium)

## Technical Notes

### Current Architecture
- **Backend**: ASP.NET Core 8.0 Razor Pages
- **Database**: SQLite with EF Core 8.0.1
- **API**: NCAA API (https://ncaa-api.henrygd.me)
- **Auth**: Windows Authentication

### Key Files Modified
1. `Models/Game.cs` - Added BracketId, VictorBracketPositionId
2. `Services/BracketSyncService.cs` - Round parsing logic
3. `Migrations/*` - Database schema updates

### Files Needing Updates
1. `Pages/SubmitBracket.cshtml` - Complete UI rewrite needed
2. `Pages/SubmitBracket.cshtml.cs` - Update game loading logic for First Four handling
3. Add JavaScript file for cascading logic
4. Add CSS for bracket visualization
5. Create test project

## Next Steps (Priority Order)

1. ✅ **DONE**: Fix database schema and round parsing
2. **TODO**: Implement cascading bracket selection (most complex, foundational for UI)
3. **TODO**: Create scrollable bracket visualization UI
4. **TODO**: Add validation with error highlighting
5. **TODO**: Handle First Four play-in game display
6. **TODO**: Write comprehensive unit tests

## Estimated Time Remaining
- Cascading Logic: 2-3 hours
- UI Visualization: 3-4 hours  
- Validation: 1 hour
- First Four Handling: 1-2 hours
- Tests: 2-3 hours
- **Total**: ~9-13 hours

## Questions/Decisions Needed
1. Should First Four games still be stored in database? (Yes, for historical data)
2. How to handle play-in display - show both teams or just "TBD"? (Show "(Team A / Team B)")
3. Test framework preference? (Suggest xUnit + Playwright for UI tests)
4. Should cascading be saved to database immediately or only on final submit? (Only on submit - client-side only until then)
