# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bracket City Benchmark is a system for evaluating LLM performance on bracket-based word-substitution puzzles. The benchmark tests different models and measures metrics like success rate, percentage of clues solved, solution accuracy, and time to solve.

## Commands

### Installation

```bash
# Install dependencies
bun install
```

### Data Collection

```bash
# Fetch puzzle solutions from the API
bun run fetch-solutions

# Capture puzzle screenshots
bun run capture-puzzles
```

### Running Benchmarks

```bash
# Run the benchmark script for all models and dates
bun run run-benchmarks

# Run benchmarks for specific models only
bun run run-benchmarks --model claude-4-sonnet-20250514-32k-thinking --model gpt-4o

# Run benchmarks with custom concurrency
bun run run-benchmarks --concurrency 5

# Solve a single puzzle (for testing)
bun run solve-puzzle

# Solve a specific puzzle with a specific model
bun run solve-puzzle --model claude-4-sonnet-20250514-32k-thinking --date 2025-04-25

# Aggregate benchmark results
bun run aggregate-results
```

### Development

```bash
# Format code with Prettier
bun run format
```


## Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Configure API keys in `.env`:
   ```
   OPENROUTER_API_KEY="your-api-key-here"
   ```

## Architecture

The benchmark system consists of:

1. **Data Collection Tools**:
   - `fetch-solutions.ts`: Retrieves puzzle solutions from API
   - `capture-puzzles.ts`: Creates screenshots of puzzles

2. **Benchmark Engine** (`run-benchmarks.ts`):
   - Configures models to test
   - Loads puzzle data
   - Calls LLMs with puzzle inputs
   - Calculates metrics
   - Saves results as JSON

3. **Puzzle Solver** (`solve-puzzle.ts`):
   - Core LLM puzzle-solving logic
   - Model configurations and prompts
   - Single puzzle solver for testing

4. **Results Processing**:
   - `aggregate-results.ts`: Processes and summarizes benchmark data
   - Stores full results in JSON files in `/results` directory
   - Maintains a summary in `results-summary.csv`

The repository includes puzzle images (in `/puzzles`) and puzzle solution files (in `/solutions`).
