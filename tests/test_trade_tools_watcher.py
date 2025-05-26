from trade_tools_watcher import get_params


def test_get_params():
    """
    Test the get_params function to ensure it returns the expected parameters.
    """
    expected_params = {
        "facet.multiselect": "true",
        "p-id": 'categoryPathId:"951"',
        "pagetype": "boolean",
        "rows": 48,
        "start": 0,
        "version": "V2",
    }

    params = get_params(951)

    assert (
        params["p-id"] == expected_params["p-id"]
    ), f"Expected p-id {expected_params['p-id']}, but got {params['p-id']}"
    assert params == expected_params, f"Expected {expected_params}, but got {params}"
