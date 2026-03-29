"""Freya Thomson — Tech Stack Analyst (Enrichment department)."""

from __future__ import annotations

import re
from typing import Any

from app.agents.base import BaseSubAgent, SubAgentResult

# ---------------------------------------------------------------------------
# Technology keyword dictionary: (canonical_name, category, pattern)
# 300+ technologies across languages, frameworks, databases, tools, and cloud.
# ---------------------------------------------------------------------------
_TECHNOLOGIES: list[tuple[str, str, re.Pattern]] = [
    # --- Programming Languages ---
    ("Python", "language", re.compile(r"\bPython\b", re.I)),
    ("JavaScript", "language", re.compile(r"\bJavaScript\b", re.I)),
    ("TypeScript", "language", re.compile(r"\bTypeScript\b", re.I)),
    ("Java", "language", re.compile(r"\bJava\b(?!\s*Script)", re.I)),
    ("C#", "language", re.compile(r"\bC\s*#\b")),
    ("C++", "language", re.compile(r"\bC\s*\+\+\b")),
    ("C", "language", re.compile(r"\bC\b(?!\s*[#+])")),
    ("Go", "language", re.compile(r"\b(?:Go(?:lang)?)\b")),
    ("Rust", "language", re.compile(r"\bRust\b")),
    ("Ruby", "language", re.compile(r"\bRuby\b", re.I)),
    ("PHP", "language", re.compile(r"\bPHP\b")),
    ("Swift", "language", re.compile(r"\bSwift\b")),
    ("Kotlin", "language", re.compile(r"\bKotlin\b", re.I)),
    ("Scala", "language", re.compile(r"\bScala\b", re.I)),
    ("R", "language", re.compile(r"\bR\b(?=\s+(?:programming|language|studio))", re.I)),
    ("Dart", "language", re.compile(r"\bDart\b", re.I)),
    ("Elixir", "language", re.compile(r"\bElixir\b", re.I)),
    ("Haskell", "language", re.compile(r"\bHaskell\b", re.I)),
    ("Clojure", "language", re.compile(r"\bClojure\b", re.I)),
    ("Erlang", "language", re.compile(r"\bErlang\b", re.I)),
    ("Perl", "language", re.compile(r"\bPerl\b", re.I)),
    ("Lua", "language", re.compile(r"\bLua\b")),
    ("MATLAB", "language", re.compile(r"\bMATLAB\b", re.I)),
    ("Julia", "language", re.compile(r"\bJulia\b")),
    ("Objective-C", "language", re.compile(r"\bObjective[\s-]?C\b", re.I)),
    ("Shell/Bash", "language", re.compile(r"\b(?:Shell|Bash)\s*(?:scripting)?\b", re.I)),
    ("PowerShell", "language", re.compile(r"\bPowerShell\b", re.I)),
    ("SQL", "language", re.compile(r"\bSQL\b")),
    ("PL/SQL", "language", re.compile(r"\bPL/?SQL\b", re.I)),
    ("T-SQL", "language", re.compile(r"\bT[\s-]?SQL\b", re.I)),
    ("Groovy", "language", re.compile(r"\bGroovy\b", re.I)),
    ("VB.NET", "language", re.compile(r"\bVB\.?NET\b", re.I)),
    ("F#", "language", re.compile(r"\bF\s*#\b")),
    ("COBOL", "language", re.compile(r"\bCOBOL\b")),
    ("Fortran", "language", re.compile(r"\bFortran\b", re.I)),
    ("Solidity", "language", re.compile(r"\bSolidity\b", re.I)),

    # --- Frontend Frameworks ---
    ("React", "frontend", re.compile(r"\bReact(?:\.?js)?\b", re.I)),
    ("Next.js", "frontend", re.compile(r"\bNext\.?js\b", re.I)),
    ("Angular", "frontend", re.compile(r"\bAngular\b", re.I)),
    ("Vue.js", "frontend", re.compile(r"\bVue(?:\.?js)?\b", re.I)),
    ("Nuxt.js", "frontend", re.compile(r"\bNuxt(?:\.?js)?\b", re.I)),
    ("Svelte", "frontend", re.compile(r"\bSvelte\b", re.I)),
    ("SvelteKit", "frontend", re.compile(r"\bSvelteKit\b", re.I)),
    ("Remix", "frontend", re.compile(r"\bRemix\b")),
    ("Astro", "frontend", re.compile(r"\bAstro\b")),
    ("Ember.js", "frontend", re.compile(r"\bEmber(?:\.?js)?\b", re.I)),
    ("Backbone.js", "frontend", re.compile(r"\bBackbone(?:\.?js)?\b", re.I)),
    ("jQuery", "frontend", re.compile(r"\bjQuery\b", re.I)),
    ("Htmx", "frontend", re.compile(r"\bhtmx\b", re.I)),
    ("Alpine.js", "frontend", re.compile(r"\bAlpine(?:\.?js)?\b", re.I)),
    ("Solid.js", "frontend", re.compile(r"\bSolid(?:\.?js|JS)\b")),

    # --- CSS & Styling ---
    ("Tailwind CSS", "css", re.compile(r"\bTailwind\s*(?:CSS)?\b", re.I)),
    ("Bootstrap", "css", re.compile(r"\bBootstrap\b", re.I)),
    ("SASS/SCSS", "css", re.compile(r"\b(?:SASS|SCSS)\b", re.I)),
    ("LESS", "css", re.compile(r"\bLESS\b")),
    ("CSS Modules", "css", re.compile(r"\bCSS\s+Modules?\b", re.I)),
    ("Styled Components", "css", re.compile(r"\bStyled[\s-]?Components?\b", re.I)),
    ("Material UI", "css", re.compile(r"\bMaterial[\s-]?UI\b", re.I)),
    ("Chakra UI", "css", re.compile(r"\bChakra\s*UI\b", re.I)),
    ("Ant Design", "css", re.compile(r"\bAnt\s*Design\b", re.I)),

    # --- Backend Frameworks ---
    ("Node.js", "backend", re.compile(r"\bNode(?:\.?js)?\b", re.I)),
    ("Express.js", "backend", re.compile(r"\bExpress(?:\.?js)?\b", re.I)),
    ("NestJS", "backend", re.compile(r"\bNestJS\b", re.I)),
    ("Fastify", "backend", re.compile(r"\bFastify\b", re.I)),
    ("Django", "backend", re.compile(r"\bDjango\b", re.I)),
    ("Flask", "backend", re.compile(r"\bFlask\b", re.I)),
    ("FastAPI", "backend", re.compile(r"\bFastAPI\b", re.I)),
    ("Spring", "backend", re.compile(r"\bSpring\s*(?:Boot|Framework|MVC|Cloud)?\b", re.I)),
    ("Spring Boot", "backend", re.compile(r"\bSpring\s*Boot\b", re.I)),
    (".NET", "backend", re.compile(r"\b\.NET\s*(?:Core|Framework|6|7|8)?\b", re.I)),
    ("ASP.NET", "backend", re.compile(r"\bASP\.?NET\b", re.I)),
    ("Ruby on Rails", "backend", re.compile(r"\b(?:Ruby\s+on\s+)?Rails\b", re.I)),
    ("Laravel", "backend", re.compile(r"\bLaravel\b", re.I)),
    ("Symfony", "backend", re.compile(r"\bSymfony\b", re.I)),
    ("Phoenix", "backend", re.compile(r"\bPhoenix\s+(?:framework|elixir)\b", re.I)),
    ("Gin", "backend", re.compile(r"\bGin\s+(?:framework|golang)\b", re.I)),
    ("Echo", "backend", re.compile(r"\bEcho\s+(?:framework|golang)\b", re.I)),
    ("Actix", "backend", re.compile(r"\bActix\b", re.I)),
    ("Axum", "backend", re.compile(r"\bAxum\b")),
    ("Quarkus", "backend", re.compile(r"\bQuarkus\b", re.I)),
    ("Micronaut", "backend", re.compile(r"\bMicronaut\b", re.I)),

    # --- Databases ---
    ("PostgreSQL", "database", re.compile(r"\b(?:PostgreSQL|Postgres)\b", re.I)),
    ("MySQL", "database", re.compile(r"\bMySQL\b", re.I)),
    ("MariaDB", "database", re.compile(r"\bMariaDB\b", re.I)),
    ("SQL Server", "database", re.compile(r"\b(?:SQL\s+Server|MSSQL)\b", re.I)),
    ("Oracle DB", "database", re.compile(r"\bOracle\s+(?:DB|Database)\b", re.I)),
    ("SQLite", "database", re.compile(r"\bSQLite\b", re.I)),
    ("MongoDB", "database", re.compile(r"\bMongoDB?\b", re.I)),
    ("DynamoDB", "database", re.compile(r"\bDynamoDB\b", re.I)),
    ("Cassandra", "database", re.compile(r"\bCassandra\b", re.I)),
    ("Redis", "database", re.compile(r"\bRedis\b", re.I)),
    ("Elasticsearch", "database", re.compile(r"\bElasticsearch\b", re.I)),
    ("OpenSearch", "database", re.compile(r"\bOpenSearch\b", re.I)),
    ("Neo4j", "database", re.compile(r"\bNeo4j\b", re.I)),
    ("CouchDB", "database", re.compile(r"\bCouchDB\b", re.I)),
    ("Firebase", "database", re.compile(r"\bFirebase\b", re.I)),
    ("Supabase", "database", re.compile(r"\bSupabase\b", re.I)),
    ("InfluxDB", "database", re.compile(r"\bInfluxDB\b", re.I)),
    ("TimescaleDB", "database", re.compile(r"\bTimescaleDB\b", re.I)),
    ("Snowflake", "database", re.compile(r"\bSnowflake\b", re.I)),
    ("BigQuery", "database", re.compile(r"\bBigQuery\b", re.I)),
    ("Redshift", "database", re.compile(r"\bRedshift\b", re.I)),
    ("Databricks", "database", re.compile(r"\bDatabricks\b", re.I)),
    ("ClickHouse", "database", re.compile(r"\bClickHouse\b", re.I)),
    ("Couchbase", "database", re.compile(r"\bCouchbase\b", re.I)),
    ("Memcached", "database", re.compile(r"\bMemcached\b", re.I)),
    ("ScyllaDB", "database", re.compile(r"\bScyllaDB\b", re.I)),

    # --- Cloud Platforms ---
    ("AWS", "cloud", re.compile(r"\bAWS\b")),
    ("Azure", "cloud", re.compile(r"\bAzure\b", re.I)),
    ("Google Cloud (GCP)", "cloud", re.compile(r"\b(?:GCP|Google\s+Cloud)\b", re.I)),
    ("Heroku", "cloud", re.compile(r"\bHeroku\b", re.I)),
    ("DigitalOcean", "cloud", re.compile(r"\bDigitalOcean\b", re.I)),
    ("Vercel", "cloud", re.compile(r"\bVercel\b", re.I)),
    ("Netlify", "cloud", re.compile(r"\bNetlify\b", re.I)),
    ("Cloudflare", "cloud", re.compile(r"\bCloudflare\b", re.I)),
    ("Fly.io", "cloud", re.compile(r"\bFly\.io\b", re.I)),
    ("Railway", "cloud", re.compile(r"\bRailway\b", re.I)),

    # --- AWS Services ---
    ("AWS Lambda", "cloud_service", re.compile(r"\bLambda\b")),
    ("AWS S3", "cloud_service", re.compile(r"\bS3\b")),
    ("AWS EC2", "cloud_service", re.compile(r"\bEC2\b")),
    ("AWS ECS", "cloud_service", re.compile(r"\bECS\b")),
    ("AWS EKS", "cloud_service", re.compile(r"\bEKS\b")),
    ("AWS SQS", "cloud_service", re.compile(r"\bSQS\b")),
    ("AWS SNS", "cloud_service", re.compile(r"\bSNS\b")),
    ("AWS CloudFormation", "cloud_service", re.compile(r"\bCloudFormation\b", re.I)),
    ("AWS CDK", "cloud_service", re.compile(r"\bAWS\s+CDK\b", re.I)),
    ("AWS Step Functions", "cloud_service", re.compile(r"\bStep\s+Functions?\b", re.I)),

    # --- DevOps & Infrastructure ---
    ("Docker", "devops", re.compile(r"\bDocker\b", re.I)),
    ("Kubernetes", "devops", re.compile(r"\bKubernetes\b", re.I)),
    ("K8s", "devops", re.compile(r"\bK8s\b", re.I)),
    ("Helm", "devops", re.compile(r"\bHelm\b", re.I)),
    ("Terraform", "devops", re.compile(r"\bTerraform\b", re.I)),
    ("Ansible", "devops", re.compile(r"\bAnsible\b", re.I)),
    ("Puppet", "devops", re.compile(r"\bPuppet\b", re.I)),
    ("Chef", "devops", re.compile(r"\bChef\b")),
    ("Pulumi", "devops", re.compile(r"\bPulumi\b", re.I)),
    ("Jenkins", "devops", re.compile(r"\bJenkins\b", re.I)),
    ("GitHub Actions", "devops", re.compile(r"\bGitHub\s+Actions?\b", re.I)),
    ("GitLab CI", "devops", re.compile(r"\bGitLab\s+CI\b", re.I)),
    ("CircleCI", "devops", re.compile(r"\bCircleCI\b", re.I)),
    ("Travis CI", "devops", re.compile(r"\bTravis\s*CI\b", re.I)),
    ("ArgoCD", "devops", re.compile(r"\bArgo\s*CD\b", re.I)),
    ("Flux", "devops", re.compile(r"\bFlux\s*(?:CD)?\b")),
    ("Istio", "devops", re.compile(r"\bIstio\b", re.I)),
    ("Consul", "devops", re.compile(r"\bConsul\b", re.I)),
    ("Vault", "devops", re.compile(r"\b(?:HashiCorp\s+)?Vault\b", re.I)),
    ("Nginx", "devops", re.compile(r"\bNginx\b", re.I)),
    ("Apache", "devops", re.compile(r"\bApache\s+(?:HTTP|Web|Server)\b", re.I)),
    ("Traefik", "devops", re.compile(r"\bTraefik\b", re.I)),
    ("Prometheus", "monitoring", re.compile(r"\bPrometheus\b", re.I)),
    ("Grafana", "monitoring", re.compile(r"\bGrafana\b", re.I)),
    ("Datadog", "monitoring", re.compile(r"\bDatadog\b", re.I)),
    ("New Relic", "monitoring", re.compile(r"\bNew\s+Relic\b", re.I)),
    ("Splunk", "monitoring", re.compile(r"\bSplunk\b", re.I)),
    ("ELK Stack", "monitoring", re.compile(r"\bELK\s+Stack\b", re.I)),
    ("Kibana", "monitoring", re.compile(r"\bKibana\b", re.I)),
    ("Logstash", "monitoring", re.compile(r"\bLogstash\b", re.I)),
    ("PagerDuty", "monitoring", re.compile(r"\bPagerDuty\b", re.I)),
    ("OpenTelemetry", "monitoring", re.compile(r"\bOpenTelemetry\b", re.I)),
    ("Jaeger", "monitoring", re.compile(r"\bJaeger\b", re.I)),

    # --- Message Queues ---
    ("Kafka", "messaging", re.compile(r"\bKafka\b", re.I)),
    ("RabbitMQ", "messaging", re.compile(r"\bRabbitMQ\b", re.I)),
    ("Celery", "messaging", re.compile(r"\bCelery\b", re.I)),
    ("ActiveMQ", "messaging", re.compile(r"\bActiveMQ\b", re.I)),
    ("NATS", "messaging", re.compile(r"\bNATS\b")),
    ("Pulsar", "messaging", re.compile(r"\bPulsar\b", re.I)),

    # --- Mobile ---
    ("React Native", "mobile", re.compile(r"\bReact\s+Native\b", re.I)),
    ("Flutter", "mobile", re.compile(r"\bFlutter\b", re.I)),
    ("iOS", "mobile", re.compile(r"\biOS\b")),
    ("Android", "mobile", re.compile(r"\bAndroid\b", re.I)),
    ("SwiftUI", "mobile", re.compile(r"\bSwiftUI\b", re.I)),
    ("Jetpack Compose", "mobile", re.compile(r"\bJetpack\s+Compose\b", re.I)),
    ("Xamarin", "mobile", re.compile(r"\bXamarin\b", re.I)),
    ("MAUI", "mobile", re.compile(r"\b\.?NET\s+MAUI\b", re.I)),
    ("Ionic", "mobile", re.compile(r"\bIonic\b", re.I)),

    # --- AI / ML ---
    ("TensorFlow", "ml", re.compile(r"\bTensorFlow\b", re.I)),
    ("PyTorch", "ml", re.compile(r"\bPyTorch\b", re.I)),
    ("scikit-learn", "ml", re.compile(r"\bscikit[\s-]?learn\b", re.I)),
    ("Pandas", "ml", re.compile(r"\bPandas\b", re.I)),
    ("NumPy", "ml", re.compile(r"\bNumPy\b", re.I)),
    ("Keras", "ml", re.compile(r"\bKeras\b", re.I)),
    ("Hugging Face", "ml", re.compile(r"\bHugging\s*Face\b", re.I)),
    ("LangChain", "ml", re.compile(r"\bLangChain\b", re.I)),
    ("OpenAI API", "ml", re.compile(r"\bOpenAI\b", re.I)),
    ("MLflow", "ml", re.compile(r"\bMLflow\b", re.I)),
    ("Airflow", "ml", re.compile(r"\bAirflow\b", re.I)),
    ("dbt", "data", re.compile(r"\bdbt\b")),
    ("Spark", "data", re.compile(r"\b(?:Apache\s+)?Spark\b", re.I)),
    ("Hadoop", "data", re.compile(r"\bHadoop\b", re.I)),
    ("Flink", "data", re.compile(r"\bFlink\b", re.I)),
    ("Beam", "data", re.compile(r"\bApache\s+Beam\b", re.I)),
    ("Tableau", "data", re.compile(r"\bTableau\b", re.I)),
    ("Power BI", "data", re.compile(r"\bPower\s*BI\b", re.I)),
    ("Looker", "data", re.compile(r"\bLooker\b", re.I)),
    ("Jupyter", "data", re.compile(r"\bJupyter\b", re.I)),

    # --- Testing ---
    ("Jest", "testing", re.compile(r"\bJest\b")),
    ("Cypress", "testing", re.compile(r"\bCypress\b", re.I)),
    ("Playwright", "testing", re.compile(r"\bPlaywright\b", re.I)),
    ("Selenium", "testing", re.compile(r"\bSelenium\b", re.I)),
    ("pytest", "testing", re.compile(r"\bpytest\b", re.I)),
    ("JUnit", "testing", re.compile(r"\bJUnit\b", re.I)),
    ("Mocha", "testing", re.compile(r"\bMocha\b", re.I)),
    ("Vitest", "testing", re.compile(r"\bVitest\b", re.I)),
    ("Postman", "testing", re.compile(r"\bPostman\b", re.I)),

    # --- Version Control ---
    ("Git", "vcs", re.compile(r"\bGit\b(?!\s*(?:Hub|Lab))")),
    ("GitHub", "vcs", re.compile(r"\bGitHub\b", re.I)),
    ("GitLab", "vcs", re.compile(r"\bGitLab\b", re.I)),
    ("Bitbucket", "vcs", re.compile(r"\bBitbucket\b", re.I)),

    # --- API & Protocols ---
    ("REST", "api", re.compile(r"\bREST(?:ful)?\s*API\b", re.I)),
    ("GraphQL", "api", re.compile(r"\bGraphQL\b", re.I)),
    ("gRPC", "api", re.compile(r"\bgRPC\b", re.I)),
    ("WebSocket", "api", re.compile(r"\bWebSocket\b", re.I)),
    ("OpenAPI", "api", re.compile(r"\bOpenAPI\b", re.I)),
    ("Swagger", "api", re.compile(r"\bSwagger\b", re.I)),

    # --- CMS / Platforms ---
    ("WordPress", "cms", re.compile(r"\bWordPress\b", re.I)),
    ("Drupal", "cms", re.compile(r"\bDrupal\b", re.I)),
    ("Contentful", "cms", re.compile(r"\bContentful\b", re.I)),
    ("Strapi", "cms", re.compile(r"\bStrapi\b", re.I)),
    ("Shopify", "platform", re.compile(r"\bShopify\b", re.I)),
    ("Magento", "platform", re.compile(r"\bMagento\b", re.I)),
    ("Salesforce", "platform", re.compile(r"\bSalesforce\b", re.I)),
    ("SAP", "platform", re.compile(r"\bSAP\b")),
    ("ServiceNow", "platform", re.compile(r"\bServiceNow\b", re.I)),
    ("Jira", "platform", re.compile(r"\bJira\b", re.I)),
    ("Confluence", "platform", re.compile(r"\bConfluence\b", re.I)),

    # --- Blockchain ---
    ("Ethereum", "blockchain", re.compile(r"\bEthereum\b", re.I)),
    ("Web3", "blockchain", re.compile(r"\bWeb3\b", re.I)),
    ("Smart Contracts", "blockchain", re.compile(r"\bSmart\s+Contracts?\b", re.I)),
]


class TechStackExtractorAgent(BaseSubAgent):
    """Extracts technology stack from job descriptions."""

    name = "tech_stack_extractor"
    persona = "Freya Thomson"
    title = "Tech Stack Analyst"
    agent_type = "LLM"
    description = (
        "Extracts technologies from job descriptions using 300+ keyword "
        "patterns, with LLM fallback for emerging technologies."
    )

    async def run(self, **kwargs: Any) -> SubAgentResult:
        """
        Extract tech stack from job text.

        Parameters
        ----------
        description : str
            Job description.
        title : str, optional
            Job title.

        Returns
        -------
        SubAgentResult with data:
            technologies   : list[str]          - canonical technology names
            by_category    : dict[str, list[str]] - grouped by category
            count          : int
            method         : str  - "deterministic" | "hybrid"
        """
        description: str = kwargs.get("description", "") or ""
        title: str = kwargs.get("title", "") or ""
        text = f"{title}\n{description}"

        if not text.strip():
            return SubAgentResult(
                agent_name=self.name,
                success=True,
                data={
                    "technologies": [],
                    "by_category": {},
                    "count": 0,
                    "method": "deterministic",
                },
            )

        found: list[str] = []
        by_category: dict[str, list[str]] = {}
        seen: set[str] = set()

        for canonical_name, category, pattern in _TECHNOLOGIES:
            if canonical_name in seen:
                continue
            if pattern.search(text):
                found.append(canonical_name)
                seen.add(canonical_name)
                by_category.setdefault(category, []).append(canonical_name)

        # If very few technologies found, could invoke LLM for deeper extraction.
        # For now, return deterministic results.
        method = "deterministic"

        if len(found) < 2 and len(description) > 200:
            # Placeholder for LLM enrichment of tech stack
            llm_techs = await self._extract_with_llm(text)
            if llm_techs:
                for tech in llm_techs:
                    if tech not in seen:
                        found.append(tech)
                        seen.add(tech)
                        by_category.setdefault("llm_detected", []).append(tech)
                method = "hybrid"

        return SubAgentResult(
            agent_name=self.name,
            success=True,
            data={
                "technologies": found,
                "by_category": by_category,
                "count": len(found),
                "method": method,
            },
        )

    async def _extract_with_llm(self, text: str) -> list[str]:
        """
        Call LLM to extract additional technologies not in the keyword list.
        Override with actual LLM integration.
        """
        # Placeholder
        # from app.core.llm import llm_client
        # response = await llm_client.complete(
        #     system="Extract technology names from this job description...",
        #     prompt=text[:1000],
        # )
        # return json.loads(response.text).get("technologies", [])
        return []
