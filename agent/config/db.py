import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from contextlib import contextmanager # <--- Add this import
load_dotenv()
DB_URL = os.getenv("DATABASE_URL")


@contextmanager
def get_db_connection():
    """
    Creates a new database connection. 
    Using RealDictCursor means your SQL results come back as Python dictionaries 
    (e.g., row['extracted_text']) instead of confusing tuples!
    """
    conn = psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)
    try:
        yield conn
    finally:
        conn.close()