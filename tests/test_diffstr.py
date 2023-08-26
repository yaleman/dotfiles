from dotfiles.diffstr import diff_string_suffix


def test_suffix_matching() -> None:
    assert diff_string_suffix("hello world", "hello world") is None


def test_suffix_has_suffix() -> None:
    assert diff_string_suffix("hello world", "hello world foo") == ("", " foo")
