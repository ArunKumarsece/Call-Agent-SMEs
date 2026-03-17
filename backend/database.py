# """SQLite database configuration using SQLAlchemy."""

# from sqlalchemy import create_engine
# from sqlalchemy.orm import sessionmaker, declarative_base
# import os

# DATABASE_DIR = os.path.dirname(os.path.abspath(__file__))
# DATABASE_URL = f"sqlite:///{os.path.join(DATABASE_DIR, 'agents.db')}"

# engine = create_engine(
#     DATABASE_URL,
#     connect_args={"check_same_thread": False},
#     echo=False
# )

# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
# Base = declarative_base()


# def get_db():
#     """Dependency to get DB session."""
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()


# def init_db():
#     """Create all tables."""
#     from models import Agent, KnowledgeBase, KBEntry  # noqa: F401
#     Base.metadata.create_all(bind=engine)


"""SQLite database configuration using SQLAlchemy."""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_URL = f"sqlite:///{os.path.join(DATABASE_DIR, 'agents.db')}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables (including new auth tables)."""
    from models import Company, User, RefreshToken, Agent, KnowledgeBase, KBEntry, CallSession  # noqa
    Base.metadata.create_all(bind=engine)
