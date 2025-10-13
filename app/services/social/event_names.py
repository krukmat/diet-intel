"""Centralized event names for social features"""
from enum import Enum


class UserAction(Enum):
    """User action event types"""
    USER_BLOCKED = "UserAction.UserBlocked"
    USER_UNBLOCKED = "UserAction.UserUnblocked"
    USER_FOLLOWED = "UserAction.UserFollowed"
    USER_UNFOLLOWED = "UserAction.UserUnfollowed"
