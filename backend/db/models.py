from sqlalchemy import Column, ForeignKey, Integer, String, DateTime, Text
from .database import Base
from datetime import datetime
from sqlalchemy.orm import relationship,Session


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    google_user_id = Column(String, unique=True, index=True,nullable=False)
    google_id = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    access_token = Column(String, nullable=True)
    refresh_token = Column(String, nullable=True)
    token_created = Column(DateTime, default=datetime.utcnow)


class Email(Base):
    __tablename__ = "emails"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message_id = Column(String, index=True)
    sender = Column(String)
    subject = Column(String)
    snippet = Column(String)
    body = Column(Text)
    date = Column(DateTime)
    labels = Column(String)  # Add this to Email model

    user = relationship("User")



def create_or_update_user(db: Session, google_user_id: str, email: str, access_token: str, refresh_token: str = None):
    
    user = db.query(User).filter(User.google_user_id == google_user_id).first()
    if user:
        user.email = email
        user.access_token = access_token
        user.refresh_token = refresh_token
    else:
        user = User(
            google_user_id=google_user_id,
            email=email,
            access_token=access_token,
            refresh_token=refresh_token
        )
        db.add(user)
    
    db.commit()
    db.refresh(user)
    return user
