#!/usr/bin/env python3
"""
CLI utility to run the social feed ingester manually.

This script can be used for manual runs, cron jobs, or integration testing.
Usage: python scripts/run_feed_ingester.py [--batch-size 100] [--dry-run]
"""

import argparse
import sys
import os

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.social.feed_ingester import ingest_pending_events


def main():
    parser = argparse.ArgumentParser(description='Run feed ingester to process social events')
    parser.add_argument(
        '--batch-size',
        type=int,
        default=100,
        help='Number of events to process in one batch (default: 100)'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be processed without actually doing it'
    )

    args = parser.parse_args()

    if args.dry_run:
        print("⚠️  DRY RUN MODE - No changes will be made")
        print(f"📊 Would process up to {args.batch_size} events")
        return

    try:
        print(f"🔄 Starting feed ingester with batch size {args.batch_size}...")
        processed_count = ingest_pending_events(batch_size=args.batch_size)

        if processed_count > 0:
            print(f"✅ Successfully processed {processed_count} social events")
        else:
            print("ℹ️  No pending events to process")

    except Exception as e:
        print(f"❌ Error running feed ingester: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
