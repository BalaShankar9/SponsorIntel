"""Blessing Adeyemi — Certification Extraction Specialist (Enrichment department)."""

from __future__ import annotations

import re
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

# ---------------------------------------------------------------------------
# Certification patterns: (canonical_name, category, pattern)
# ---------------------------------------------------------------------------
_CERTIFICATIONS: list[tuple[str, str, re.Pattern]] = [
    # --- Accounting & Finance ---
    ("ACCA", "accounting", re.compile(r"\bACCA\b")),
    ("ACA", "accounting", re.compile(r"\bACA\b")),
    ("CIMA", "accounting", re.compile(r"\bCIMA\b")),
    ("CPA", "accounting", re.compile(r"\bCPA\b")),
    ("AAT", "accounting", re.compile(r"\bAAT\b")),
    ("ICAEW", "accounting", re.compile(r"\bICAEW\b")),
    ("ICAS", "accounting", re.compile(r"\bICAS\b")),
    ("CFA", "finance", re.compile(r"\bCFA\b")),
    ("FRM", "finance", re.compile(r"\bFRM\b")),
    ("CAIA", "finance", re.compile(r"\bCAIA\b")),
    ("CII", "finance", re.compile(r"\bCII\b")),
    ("CISI", "finance", re.compile(r"\bCISI\b")),
    ("FCA", "finance", re.compile(r"\bFCA\s+(?:regulated|authorised)\b", re.I)),
    ("IMC", "finance", re.compile(r"\bIMC\b")),

    # --- HR & People ---
    ("CIPD", "hr", re.compile(r"\bCIPD\b")),
    ("SHRM-CP", "hr", re.compile(r"\bSHRM[\s-]?CP\b")),
    ("SHRM-SCP", "hr", re.compile(r"\bSHRM[\s-]?SCP\b")),
    ("PHR", "hr", re.compile(r"\bPHR\b")),
    ("SPHR", "hr", re.compile(r"\bSPHR\b")),

    # --- Project Management ---
    ("PRINCE2", "project_management", re.compile(r"\bPRINCE\s*2\b", re.I)),
    ("PRINCE2 Practitioner", "project_management", re.compile(r"\bPRINCE\s*2\s+Practitioner\b", re.I)),
    ("PRINCE2 Agile", "project_management", re.compile(r"\bPRINCE\s*2\s+Agile\b", re.I)),
    ("PMP", "project_management", re.compile(r"\bPMP\b")),
    ("PMI-ACP", "project_management", re.compile(r"\bPMI[\s-]?ACP\b")),
    ("CAPM", "project_management", re.compile(r"\bCAPM\b")),
    ("MSP", "project_management", re.compile(r"\bMSP\s+(?:Practitioner|Foundation)\b", re.I)),
    ("APM PMQ", "project_management", re.compile(r"\bAPM\s+PMQ\b", re.I)),
    ("APM PFQ", "project_management", re.compile(r"\bAPM\s+PFQ\b", re.I)),
    ("Scrum Master (CSM)", "agile", re.compile(r"\bCSM\b")),
    ("Professional Scrum Master", "agile", re.compile(r"\bPSM\s*[I1]\b")),
    ("SAFe Agilist", "agile", re.compile(r"\bSAFe\s+Agilist\b", re.I)),
    ("SAFe", "agile", re.compile(r"\bSAFe\s+(?:certified|practitioner|scrum)\b", re.I)),
    ("Agile PM", "agile", re.compile(r"\bAgile\s+PM\b", re.I)),

    # --- ITIL & IT Service Management ---
    ("ITIL", "itsm", re.compile(r"\bITIL\b")),
    ("ITIL Foundation", "itsm", re.compile(r"\bITIL\s+(?:v[34]\s+)?Foundation\b", re.I)),
    ("ITIL Expert", "itsm", re.compile(r"\bITIL\s+Expert\b", re.I)),
    ("COBIT", "itsm", re.compile(r"\bCOBIT\b")),
    ("TOGAF", "itsm", re.compile(r"\bTOGAF\b")),

    # --- AWS Certifications ---
    ("AWS Solutions Architect Associate", "cloud", re.compile(r"\bAWS\s+(?:Certified\s+)?Solutions?\s+Architect\s+(?:Associate|Assoc)\b", re.I)),
    ("AWS Solutions Architect Professional", "cloud", re.compile(r"\bAWS\s+(?:Certified\s+)?Solutions?\s+Architect\s+Professional\b", re.I)),
    ("AWS Developer Associate", "cloud", re.compile(r"\bAWS\s+(?:Certified\s+)?Developer\s+Associate\b", re.I)),
    ("AWS SysOps Administrator", "cloud", re.compile(r"\bAWS\s+(?:Certified\s+)?SysOps\b", re.I)),
    ("AWS DevOps Engineer", "cloud", re.compile(r"\bAWS\s+(?:Certified\s+)?DevOps\s+Engineer\b", re.I)),
    ("AWS Security Specialty", "cloud", re.compile(r"\bAWS\s+(?:Certified\s+)?Security\s+Specialty\b", re.I)),
    ("AWS Cloud Practitioner", "cloud", re.compile(r"\bAWS\s+(?:Certified\s+)?Cloud\s+Practitioner\b", re.I)),
    ("AWS Certified", "cloud", re.compile(r"\bAWS\s+Certified\b", re.I)),

    # --- Azure Certifications ---
    ("Azure Administrator (AZ-104)", "cloud", re.compile(r"\b(?:AZ[\s-]?104|Azure\s+Administrator)\b", re.I)),
    ("Azure Developer (AZ-204)", "cloud", re.compile(r"\b(?:AZ[\s-]?204|Azure\s+Developer)\b", re.I)),
    ("Azure Solutions Architect (AZ-305)", "cloud", re.compile(r"\b(?:AZ[\s-]?305|Azure\s+Solutions?\s+Architect)\b", re.I)),
    ("Azure DevOps Engineer (AZ-400)", "cloud", re.compile(r"\b(?:AZ[\s-]?400|Azure\s+DevOps\s+Engineer)\b", re.I)),
    ("Azure Security Engineer (AZ-500)", "cloud", re.compile(r"\b(?:AZ[\s-]?500|Azure\s+Security\s+Engineer)\b", re.I)),
    ("Azure Data Engineer (DP-203)", "cloud", re.compile(r"\b(?:DP[\s-]?203|Azure\s+Data\s+Engineer)\b", re.I)),
    ("Azure AI Engineer (AI-102)", "cloud", re.compile(r"\b(?:AI[\s-]?102|Azure\s+AI\s+Engineer)\b", re.I)),
    ("Azure Fundamentals (AZ-900)", "cloud", re.compile(r"\b(?:AZ[\s-]?900|Azure\s+Fundamentals)\b", re.I)),
    ("Microsoft Certified", "cloud", re.compile(r"\bMicrosoft\s+Certified\b", re.I)),

    # --- GCP Certifications ---
    ("GCP Professional Cloud Architect", "cloud", re.compile(r"\bGCP\s+(?:Professional\s+)?Cloud\s+Architect\b", re.I)),
    ("GCP Professional Data Engineer", "cloud", re.compile(r"\bGCP\s+(?:Professional\s+)?Data\s+Engineer\b", re.I)),
    ("GCP Associate Cloud Engineer", "cloud", re.compile(r"\bGCP\s+Associate\s+Cloud\s+Engineer\b", re.I)),
    ("Google Cloud Certified", "cloud", re.compile(r"\bGoogle\s+Cloud\s+Certified\b", re.I)),

    # --- Cybersecurity ---
    ("CISSP", "security", re.compile(r"\bCISSP\b")),
    ("CISM", "security", re.compile(r"\bCISM\b")),
    ("CISA", "security", re.compile(r"\bCISA\b")),
    ("CEH", "security", re.compile(r"\bCEH\b")),
    ("CompTIA Security+", "security", re.compile(r"\b(?:CompTIA\s+)?Security\s*\+\b", re.I)),
    ("CompTIA Network+", "networking", re.compile(r"\b(?:CompTIA\s+)?Network\s*\+\b", re.I)),
    ("CompTIA A+", "it", re.compile(r"\b(?:CompTIA\s+)?A\s*\+\b", re.I)),
    ("OSCP", "security", re.compile(r"\bOSCP\b")),
    ("GIAC", "security", re.compile(r"\bGIAC\b")),
    ("CCSP", "security", re.compile(r"\bCCSP\b")),
    ("ISO 27001 Lead Auditor", "security", re.compile(r"\bISO\s*27001\s+Lead\s+Auditor\b", re.I)),
    ("ISO 27001", "security", re.compile(r"\bISO\s*27001\b")),
    ("Cyber Essentials", "security", re.compile(r"\bCyber\s+Essentials\b", re.I)),
    ("SC Cleared", "security_clearance", re.compile(r"\bSC\s+Clear(?:ed|ance)\b", re.I)),
    ("DV Cleared", "security_clearance", re.compile(r"\bDV\s+Clear(?:ed|ance)\b", re.I)),
    ("CTC", "security_clearance", re.compile(r"\bCTC\s+Clear(?:ed|ance)\b", re.I)),

    # --- Cisco ---
    ("CCNA", "networking", re.compile(r"\bCCNA\b")),
    ("CCNP", "networking", re.compile(r"\bCCNP\b")),
    ("CCIE", "networking", re.compile(r"\bCCIE\b")),

    # --- Data & Analytics ---
    ("Databricks Certified", "data", re.compile(r"\bDatabricks\s+Certified\b", re.I)),
    ("Snowflake SnowPro", "data", re.compile(r"\bSnowPro\b", re.I)),
    ("Tableau Certified", "data", re.compile(r"\bTableau\s+(?:Desktop\s+)?Certified\b", re.I)),
    ("Power BI Certified", "data", re.compile(r"\bPower\s+BI\s+(?:Data\s+Analyst\s+)?Certified\b", re.I)),
    ("SAS Certified", "data", re.compile(r"\bSAS\s+Certified\b", re.I)),
    ("Certified Analytics Professional", "data", re.compile(r"\bCAP\b")),

    # --- DevOps & Containers ---
    ("Kubernetes (CKA)", "devops", re.compile(r"\bCKA\b")),
    ("Kubernetes (CKAD)", "devops", re.compile(r"\bCKAD\b")),
    ("Kubernetes (CKS)", "devops", re.compile(r"\bCKS\b")),
    ("Docker Certified Associate", "devops", re.compile(r"\bDocker\s+Certified\b", re.I)),
    ("HashiCorp Certified", "devops", re.compile(r"\bHashiCorp\s+Certified\b", re.I)),
    ("Terraform Associate", "devops", re.compile(r"\bTerraform\s+Associate\b", re.I)),
    ("Jenkins Certified", "devops", re.compile(r"\bJenkins\s+(?:Certified|Engineer)\b", re.I)),

    # --- Software Development ---
    ("Oracle Certified Java", "development", re.compile(r"\bOracle\s+Certified\s+(?:Professional\s+)?Java\b", re.I)),
    ("Oracle Certified", "development", re.compile(r"\bOracle\s+Certified\b", re.I)),
    ("Salesforce Certified", "development", re.compile(r"\bSalesforce\s+Certified\b", re.I)),
    ("Salesforce Administrator", "development", re.compile(r"\bSalesforce\s+(?:Certified\s+)?Administrator\b", re.I)),
    ("ServiceNow Certified", "itsm", re.compile(r"\bServiceNow\s+Certified\b", re.I)),

    # --- Healthcare ---
    ("GMC Registered", "healthcare", re.compile(r"\bGMC\s+(?:registered|registration)\b", re.I)),
    ("NMC Registered", "healthcare", re.compile(r"\bNMC\s+(?:registered|registration|pin)\b", re.I)),
    ("HCPC Registered", "healthcare", re.compile(r"\bHCPC\s+(?:registered|registration)\b", re.I)),
    ("GPhC Registered", "healthcare", re.compile(r"\bGPhC\s+(?:registered|registration)\b", re.I)),
    ("GDC Registered", "healthcare", re.compile(r"\bGDC\s+(?:registered|registration)\b", re.I)),
    ("RCGP", "healthcare", re.compile(r"\bRCGP\b")),
    ("MRCP", "healthcare", re.compile(r"\bMRCP\b")),
    ("FRCS", "healthcare", re.compile(r"\bFRCS\b")),
    ("MRCGP", "healthcare", re.compile(r"\bMRCGP\b")),
    ("ALS", "healthcare", re.compile(r"\bALS\s+(?:certified|provider|certificate)\b", re.I)),
    ("PALS", "healthcare", re.compile(r"\bPALS\b")),

    # --- Engineering ---
    ("Chartered Engineer (CEng)", "engineering", re.compile(r"\bCEng\b")),
    ("Incorporated Engineer (IEng)", "engineering", re.compile(r"\bIEng\b")),
    ("Engineering Technician (EngTech)", "engineering", re.compile(r"\bEngTech\b")),
    ("ICE", "engineering", re.compile(r"\bICE\s+(?:member|chartered)\b", re.I)),
    ("IET", "engineering", re.compile(r"\bIET\s+(?:member|chartered)\b", re.I)),
    ("IMechE", "engineering", re.compile(r"\bIMechE\b")),
    ("RIBA", "engineering", re.compile(r"\bRIBA\b")),
    ("RICS", "engineering", re.compile(r"\bRICS\b")),
    ("CIOB", "engineering", re.compile(r"\bCIOB\b")),
    ("NEBOSH", "health_safety", re.compile(r"\bNEBOSH\b")),
    ("IOSH", "health_safety", re.compile(r"\bIOSH\b")),
    ("SMSTS", "health_safety", re.compile(r"\bSMSTS\b")),
    ("SSSTS", "health_safety", re.compile(r"\bSSSTS\b")),
    ("CSCS", "construction", re.compile(r"\bCSCS\b")),
    ("CPCS", "construction", re.compile(r"\bCPCS\b")),

    # --- Legal ---
    ("SRA Qualified", "legal", re.compile(r"\bSRA\s+(?:qualified|admitted|registered)\b", re.I)),
    ("Qualified Solicitor", "legal", re.compile(r"\bqualified\s+solicitor\b", re.I)),
    ("Barrister", "legal", re.compile(r"\bcalled\s+to\s+the\s+bar\b", re.I)),
    ("LPC", "legal", re.compile(r"\bLPC\b")),
    ("SQE", "legal", re.compile(r"\bSQE\b")),
    ("CILEX", "legal", re.compile(r"\bCILEX\b")),

    # --- Teaching ---
    ("QTS", "education", re.compile(r"\bQTS\b")),
    ("PGCE", "education", re.compile(r"\bPGCE\b")),
    ("QTLS", "education", re.compile(r"\bQTLS\b")),
    ("EYFS", "education", re.compile(r"\bEYFS\b")),

    # --- Marketing & Digital ---
    ("Google Ads Certified", "marketing", re.compile(r"\bGoogle\s+Ads?\s+Certified\b", re.I)),
    ("Google Analytics Certified", "marketing", re.compile(r"\bGoogle\s+Analytics\s+(?:Certified|IQ)\b", re.I)),
    ("HubSpot Certified", "marketing", re.compile(r"\bHubSpot\s+(?:Certified|Inbound)\b", re.I)),
    ("CIM", "marketing", re.compile(r"\bCIM\s+(?:qualified|member|diploma|certificate)\b", re.I)),
    ("IDM", "marketing", re.compile(r"\bIDM\b")),

    # --- Supply Chain & Logistics ---
    ("CIPS", "procurement", re.compile(r"\bCIPS\b")),
    ("MCIPS", "procurement", re.compile(r"\bMCIPS\b")),
    ("CILT", "logistics", re.compile(r"\bCILT\b")),
    ("APICS CSCP", "supply_chain", re.compile(r"\bCSCP\b")),
    ("APICS CPIM", "supply_chain", re.compile(r"\bCPIM\b")),

    # --- Quality ---
    ("Six Sigma Green Belt", "quality", re.compile(r"\bSix\s+Sigma\s+Green\s+Belt\b", re.I)),
    ("Six Sigma Black Belt", "quality", re.compile(r"\bSix\s+Sigma\s+Black\s+Belt\b", re.I)),
    ("Lean Six Sigma", "quality", re.compile(r"\bLean\s+Six\s+Sigma\b", re.I)),
    ("ISO 9001", "quality", re.compile(r"\bISO\s*9001\b")),

    # --- Actuarial ---
    ("FIA", "actuarial", re.compile(r"\bFIA\b")),
    ("FFA", "actuarial", re.compile(r"\bFFA\b")),
    ("IFoA", "actuarial", re.compile(r"\bIFoA\b")),

    # --- Driving & Transport ---
    ("ADR", "transport", re.compile(r"\bADR\s+(?:certified|certificate|licence)\b", re.I)),
    ("CPC", "transport", re.compile(r"\bDriver\s+CPC\b", re.I)),
    ("HGV Licence", "transport", re.compile(r"\bHGV\s+(?:licence|license|class)\b", re.I)),
    ("Class 1", "transport", re.compile(r"\bClass\s+1\s+(?:HGV|licence|license|driver)\b", re.I)),
    ("Class 2", "transport", re.compile(r"\bClass\s+2\s+(?:HGV|licence|license|driver)\b", re.I)),
    ("Forklift Licence", "transport", re.compile(r"\bforklift\s+(?:licence|license|certified|certificate)\b", re.I)),

    # --- Food & Hygiene ---
    ("Food Hygiene Certificate", "food_safety", re.compile(r"\bfood\s+hygiene\s+certificate\b", re.I)),
    ("Level 2 Food Safety", "food_safety", re.compile(r"\blevel\s+2\s+food\s+safety\b", re.I)),
    ("Level 3 Food Safety", "food_safety", re.compile(r"\blevel\s+3\s+food\s+safety\b", re.I)),

    # --- DBS ---
    ("Enhanced DBS", "background_check", re.compile(r"\benhanced\s+DBS\b", re.I)),
    ("DBS Check", "background_check", re.compile(r"\bDBS\s+check\b", re.I)),

    # --- General / Academic ---
    ("PhD", "academic", re.compile(r"\bPh\.?D\.?\b", re.I)),
    ("Masters", "academic", re.compile(r"\bMaster(?:'?s)?\s+(?:degree|of)\b", re.I)),
    ("MBA", "academic", re.compile(r"\bMBA\b")),
    ("MSc", "academic", re.compile(r"\bMSc\b")),
    ("BSc", "academic", re.compile(r"\bBSc\b")),
    ("BEng", "academic", re.compile(r"\bBEng\b")),
    ("MEng", "academic", re.compile(r"\bMEng\b")),
    ("LLB", "academic", re.compile(r"\bLLB\b")),
    ("LLM", "academic", re.compile(r"\bLLM\b")),
]


class CertificationExtractorAgent(BaseSubAgent):
    """Extracts professional certifications from job descriptions."""

    name = "certification_extractor"
    persona = "Blessing Adeyemi"
    title = "Certification Extraction Specialist"
    agent_type = "DET"
    description = (
        "Deterministic extractor with 200+ regex patterns for professional "
        "certifications, accreditations, and qualifications."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        """
        Extract certifications from text.

        Parameters
        ----------
        description : str
            Job description text.

        Returns
        -------
        SubAgentResult with data:
            certifications     : list[str]          - canonical certification names
            by_category        : dict[str, list[str]] - grouped by category
            count              : int
        """
        description: str = kwargs.get("description", "") or ""

        if not description.strip():
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={
                    "certifications": [],
                    "by_category": {},
                    "count": 0,
                },
            )

        found: list[str] = []
        by_category: dict[str, list[str]] = {}
        seen: set[str] = set()

        for canonical_name, category, pattern in _CERTIFICATIONS:
            if canonical_name in seen:
                continue
            if pattern.search(description):
                found.append(canonical_name)
                seen.add(canonical_name)
                by_category.setdefault(category, []).append(canonical_name)

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "certifications": found,
                "by_category": by_category,
                "count": len(found),
            },
        )
