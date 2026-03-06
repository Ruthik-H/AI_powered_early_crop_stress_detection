from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from fastapi import Depends
from sqlalchemy.orm import Session
from database import get_db
import models
from config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


# ─── No-auth stub ─────────────────────────────────────────────────────────────
# Login/signup removed from frontend. All APIs now use a shared guest user.
# In production you can re-enable JWT by restoring the OAuth2 dependency.

class _GuestUser:
    """Dummy user object so all routes that reference current_user still work."""
    id = 1
    email = "guest@agrisense.local"
    full_name = "Farmer"


_GUEST = _GuestUser()


def get_current_user(db: Session = Depends(get_db)):
    """
    Auth-free stub: always returns the guest user.
    Ensures or creates a real DB row so foreign-key constraints are satisfied.
    """
    user = db.query(models.User).filter(models.User.id == 1).first()
    if not user:
        user = models.User(
            id=1,
            email="guest@agrisense.local",
            full_name="Farmer",
            hashed_password=get_password_hash("agrisense"),
        )
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
        except Exception:
            db.rollback()
            user = db.query(models.User).filter(models.User.id == 1).first() or _GUEST
    return user
