# 🛡️ LLM Red Teaming Toolkit Comparison

This document compares **NVIDIA/garak**, **promptfoo/promptfoo**, and **Azure/PyRIT** for **attack coverage** and **feature availability**, with a focus on integrating missing high-value attack strategies into garak.

---

## 1. Overview

| Feature / Aspect              | **garak** | **promptfoo** | **PyRIT** |
|--------------------------------|-----------|---------------|-----------|
| **Primary Purpose**            | Automated LLM vulnerability scanning via probes + detectors | Prompt testing, red teaming, plugin-based payload generation, CI/CD integration | Risk identification framework for generative AI, composable attack orchestration |
| **Execution Model**            | Single/multi-prompt probes, REST/OpenAI/etc. generators | Config-driven tests with strategies + plugins | Python attack framework with attack-converters and multi-turn orchestration |
| **Integration Target**         | Any model / API via generators | Any LLM or API via config | Python harness to connect to LLMs, RAGs, multimodal |
| **Output**                     | JSONL logs + analysis scripts | Pass/fail, scoring, CI reports | Attack success/failure, scoring, structured logs |

---

## 2. Attack Strategy Coverage

✅ = implemented  
➖ = partial / limited examples  
❌ = not available natively

| Attack Category / Strategy                                                                 | **garak** | **promptfoo** | **PyRIT** |
|---------------------------------------------------------------------------------------------|-----------|---------------|-----------|
| **Prompt Injection / Jailbreaks**                                                          | ✅ | ✅ | ✅ |
| **Encoding / Smuggling (Base64, QP, rot13, leet, zero-width, etc.)**                        | ✅ | ➖ | ➖ |
| **Advanced Encoding / Homograph + Unicode mixing**                                         | ➖ | ➖ | ❌ |
| **Filter Deactivation Templates ("turn off safety mode")**                                 | ➖ | ✅ | ➖ |
| **Multi-turn Adaptive Attacks (refine payload using model feedback)**                      | ➖ | ✅ | ✅ |
| **PII / Personal Data Exfiltration**                                                        | ➖ | ✅ | ✅ |
| **RAG / Context Exfiltration**                                                              | ❌ | ✅ | ✅ |
| **Paraphrase / Morphing / Variant Generators**                                              | ➖ | ✅ | ✅ |
| **Social Engineering / Role-play Bypass**                                                   | ➖ | ✅ | ✅ |
| **Brand Abuse / Policy Violation Content**                                                  | ❌ | ✅ | ➖ |
| **Bias Induction (age, gender, race, disability)**                                          | ✅ | ✅ | ➖ |
| **Toxicity Induction / NSFW Content**                                                       | ✅ | ✅ | ➖ |
| **Malware / Code Injection Payloads**                                                       | ➖ | ✅ | ✅ |
| **System Prompt Leakage**                                                                   | ✅ | ✅ | ✅ |
| **Multimodal Attack Payloads (image/audio)**                                                | ❌ (some primary audio implementation is there) | ❌ | ✅ |

---

## 3. Key Missing High-Value Attacks in Garak

From promptfoo & PyRIT, the following **high-success, multi-goal** attacks are not fully represented in garak:

1. **Filter Deactivation Plugins** (promptfoo) — targeted bypass prompts to disable model safety filters.
2. **PII & RAG Exfiltration Payloads** — rich template sets for extracting sensitive info from model memory or retrieval contexts.
3. **Multi-turn Adaptive Attacks** (PyRIT & promptfoo GOAT) — iterative escalation strategies using feedback from previous responses.
4. **Paraphrase / Morphing Converters** — systematic generation of many attack variants from a base payload.
5. **Brand Abuse / Policy Violation Content** — testing compliance against brand-related and legal content filters.
6. **Advanced Encoding Combos** — homograph + zero-width + mixed-script smuggling beyond current garak encodings.
7. **Multimodal Probes** — for image/audio-based prompt injection.

---

## 4. Recommendations for Garak Integration

**Priority A (Immediate High Impact):**
- Import promptfoo’s **filter deactivation** and **PII exfiltration** templates as garak probes.
- Implement PyRIT-style **multi-turn attack harness** in garak.

**Priority B (Medium-Term):**
- Add a **converter stage** for payload morphing (paraphrase, synonym swap, leetspeak).
- Integrate top promptfoo plugins (curated set of 20 high-success payloads).

**Priority C (Long-Term):**
- Add **multimodal probes** for future multimodal LLMs.
- Expand **advanced encoding/homograph** smuggling set.

---

## 5. References

- [NVIDIA/garak](https://github.com/NVIDIA/garak) — LLM vulnerability scanner  
- [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo) — Prompt testing & red teaming toolkit  
- [Azure/PyRIT](https://github.com/Azure/PyRIT) — Python Risk Identification Tool for generative AI  