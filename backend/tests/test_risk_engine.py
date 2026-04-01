from app.services.risk_engine import compute_overall_risk, score_document_level, score_section


def test_score_section_hedge_accumulates():
    text = (
        "You may be granted stock options subject to board approval. "
        "Eligibility is at the sole discretion of the company."
    )
    r = score_section(text)
    assert r.score >= 4
    assert r.tier in ("medium", "high")
    assert len(r.factors) >= 2


def test_score_document_bonus_no_clawback():
    text = "You will receive a signing bonus of $8,000 with your first paycheck."
    factors, tier = score_document_level(text, "employment")
    assert tier == "medium"
    assert any("repayment" in f.lower() or "clawback" in f.lower() for f in factors)


def test_score_document_equity_vague():
    text = (
        "You may be granted stock options from time to time, subject to approval by the committee. "
        "Employment is at will."
    )
    factors, tier = score_document_level(text, "generic")
    assert tier == "medium"
    assert any("equity" in f.lower() or "vesting" in f.lower() for f in factors)


def test_compute_overall_two_medium_sections():
    overall = compute_overall_risk(["low", "medium", "medium"], "low")
    assert overall == "medium"
