from app.services.social.follow_gateway import FollowGateway, follow_gateway


def test_follow_gateway_is_following_returns_false():
    gateway = FollowGateway()
    assert gateway.is_following("u1", "u2") is False


def test_singleton_follow_gateway_returns_false():
    assert follow_gateway.is_following("a", "b") is False
