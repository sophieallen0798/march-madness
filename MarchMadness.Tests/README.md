# March Madness Unit Tests

This test project contains unit tests for the March Madness bracket application.

## Test Structure

### BracketSyncServiceTests
Tests for the bracket synchronization service that pulls data from the NCAA API.

- **Round Number Parsing Tests**: Validates that round numbers are correctly parsed from the `BracketId` field using the formula `BracketId / 100`
  - 101 → Round 1 (First Four)
  - 201 → Round 2 (First Round)
  - 301 → Round 3 (Second Round)
  - 401 → Round 4 (Sweet Sixteen)
  - 501 → Round 5 (Elite Eight)
  - 601 → Round 6 (Final Four)
  - 701 → Round 7 (Championship)

- **Service Initialization Tests**: Validates that the service can be instantiated with proper dependencies

### StandingsServiceTests
Tests for the standings calculation service that computes user bracket scores.

- **Empty Standings Test**: Verifies empty standings when no brackets exist
- **Correct Points Calculation**: Tests that correct picks earn the appropriate points
- **Incorrect Points Calculation**: Tests that incorrect picks earn 0 points
- **Points by Round**: Validates the exponential point system
  - Round 2 = 2 points (2^1)
  - Round 3 = 4 points (2^2)
  - Round 4 = 8 points (2^3)
  - Round 5 = 16 points (2^4)
  - Round 6 = 32 points (2^5)
  - Round 7 = 64 points (2^6)
- **Standings Order**: Ensures standings are sorted by points descending

## Running Tests

Run all tests:
```powershell
dotnet test
```

Run specific test class:
```powershell
dotnet test --filter "DisplayName~StandingsService"
dotnet test --filter "DisplayName~BracketSyncService"
```

Run specific test method:
```powershell
dotnet test --filter "FullyQualifiedName~GetStandingsAsync_CorrectPointsByRound"
```

## Test Coverage

Current test coverage includes:
- ✅ Round number parsing logic
- ✅ Standings calculation with correct/incorrect picks
- ✅ Point system validation (exponential scoring)
- ✅ Empty state handling
- ✅ Standings sorting

## Technologies

- **xUnit**: Test framework
- **Moq**: Mocking framework for dependencies
- **Entity Framework Core InMemory**: In-memory database for isolated tests
- **NET 10.0**: Target framework

## Future Test Enhancements

Potential areas for additional testing:
- Integration tests with full API responses
- UI tests with Playwright or Selenium for cascading bracket logic
- Performance tests for large datasets
- Edge case handling (ties, missing data, etc.)
