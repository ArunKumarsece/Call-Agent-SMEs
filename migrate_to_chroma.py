#!/usr/bin/env python3
"""
ChromaDB Migration Script
──────────────────────────
Re-indexes all knowledge base entries for all agents into ChromaDB.
Run this after deploying the new RAG architecture to populate the vector store.

Usage:
    python migrate_to_chroma.py

Prerequisites:
    - RAG_BACKEND=chroma in .env
    - chromadb installed (pip install -r requirements.txt)
    - Backend server NOT running (to avoid DB lock issues)
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from database import SessionLocal
from models import Agent, KnowledgeBase, KBEntry
from services.vector_store import reindex_agent, get_collection_stats
from services.rag_config import RAG_BACKEND


async def main():
    print("\n" + "="*70)
    print("  ChromaDB Migration Script — Re-index All Agents")
    print("="*70 + "\n")

    # Check RAG backend
    if RAG_BACKEND != "chroma":
        print(f"❌ ERROR: RAG_BACKEND is set to '{RAG_BACKEND}'")
        print("   Set RAG_BACKEND=chroma in .env before running this script.")
        sys.exit(1)

    print(f"✅ RAG_BACKEND={RAG_BACKEND}\n")

    db = SessionLocal()

    try:
        # Get all agents
        agents = db.query(Agent).all()
        if not agents:
            print("ℹ️  No agents found in database.")
            return

        print(f"Found {len(agents)} agent(s) to process:\n")

        total_indexed = 0
        failed_agents = []

        for i, agent in enumerate(agents, 1):
            print(f"[{i}/{len(agents)}] Processing Agent: {agent.name} ({agent.id})")

            # Get KB IDs for this agent
            kb_ids = [kb.id for kb in db.query(KnowledgeBase).filter(
                KnowledgeBase.agent_id == agent.id
            ).all()]

            if not kb_ids:
                print(f"  ⚠️  No knowledge bases found — skipping\n")
                continue

            # Get all KB entries
            entries = db.query(KBEntry).filter(KBEntry.kb_id.in_(kb_ids)).all()
            if not entries:
                print(f"  ⚠️  No KB entries found — skipping\n")
                continue

            print(f"  Found {len(entries)} KB entries from {len(kb_ids)} knowledge base(s)")

            # Build entry dicts for reindex
            entry_dicts = [
                {
                    "id": e.id,
                    "content": e.content,
                    "kb_id": e.kb_id,
                    "source": e.source_file or "",
                    "chunk_index": e.chunk_index,
                    "embedding": e.embedding,
                }
                for e in entries
            ]

            try:
                # Re-index
                print(f"  🔄 Re-indexing into ChromaDB...")
                count = await reindex_agent(agent.id, entry_dicts)
                print(f"  ✅ Indexed {count} entries")
                total_indexed += count

                # Verify
                stats = get_collection_stats(agent.id)
                print(f"  📊 ChromaDB collection stats: {stats}")
                print()

            except Exception as e:
                print(f"  ❌ ERROR: {e}")
                failed_agents.append((agent.name, agent.id, str(e)))
                print()

        # Summary
        print("="*70)
        print("  Migration Complete")
        print("="*70)
        print(f"✅ Total entries indexed: {total_indexed}")
        print(f"✅ Agents processed: {len(agents) - len(failed_agents)}/{len(agents)}")

        if failed_agents:
            print(f"\n⚠️  Failed agents ({len(failed_agents)}):")
            for name, aid, err in failed_agents:
                print(f"   • {name} ({aid}): {err}")
        else:
            print("\n🎉 All agents migrated successfully!")

        print("\nℹ️  Next steps:")
        print("   1. Start the backend server: uvicorn main:app --reload")
        print("   2. Test RAG search performance")
        print("   3. Monitor ChromaDB disk usage: du -sh ./chroma_db")
        print()

    finally:
        db.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n⚠️  Migration interrupted by user.")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ FATAL ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
