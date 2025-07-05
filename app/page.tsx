"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { CalendarIcon, ChevronDown, ChevronRight } from "lucide-react";

const MONTH_ORDER = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Helper types for JSON structure
interface Metadata {
  title: string;
  tracking_id: string;
  release_date: string;
  current_release_date: string;
  total_vulnerabilities: number;
  processed_date: string;
  script_version: string;
}

interface ProductInfo {
  name: string;
  category: string;
}

interface Vulnerability {
  cve: string;
  title: string;
  cvss_score: number | null;
  exploited: boolean;
  exploitation_likely: boolean;
  threat_types: string[];
  affected_products: { id: string; name: string; category: string }[];
}

interface PatchTuesdayData {
  metadata: Metadata;
  products: Record<string, ProductInfo>;
  vulnerabilities: Vulnerability[];
}

const VULN_TYPES = [
  "Elevation of Privilege",
  "Security Feature Bypass",
  "Remote Code Execution",
  "Information Disclosure",
  "Denial of Service",
  "Spoofing",
  "Edge - Chromium",
];

// Helper for padding/aligning summary lines (top-level)
function pad(str: string, len: number) {
  return str + ' '.repeat(Math.max(0, len - str.length));
}

// Helper for CVSS severity
function getCvssSeverity(score: number | null): string {
  if (score === null) return "None";
  if (score === 0.0) return "None";
  if (score <= 3.9) return "Low";
  if (score <= 6.9) return "Medium";
  if (score <= 8.9) return "High";
  return "Critical";
}

// Helper for display category name
function displayCategory(cat: string): string {
  if (cat === "Mariner") return "Azure Linux (CBL-Mariner)";
  return cat;
}

// Helper for CVE URL
function getCveUrl(cve: string, title: string | undefined) {
  if (title && title !== 'N/A') {
    return `https://msrc.microsoft.com/update-guide/vulnerability/${cve}`;
  }
  return `https://www.cve.org/CVERecord?id=${cve}`;
}

export default function PatchTuesday() {
  const [data, setData] = useState<PatchTuesdayData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [filteredVulns, setFilteredVulns] = useState<Vulnerability[]>([]);
  const [showSummary, setShowSummary] = useState(true);
  const [cvssSort, setCvssSort] = useState<'desc' | 'asc' | ''>('');
  const [patches, setPatches] = useState<Record<string, string[]>>({});
  const [openYears, setOpenYears] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // GitHub config
  const GITHUB_USER = "ghostbyt3";
  const GITHUB_REPO = "patch-tuesday";
  const BRANCH = "main";
  const baseRawUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}/History/`;

  // Fetch index.json from GitHub and group by year
  useEffect(() => {
    fetch(baseRawUrl + "index.json")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch index.json");
        return res.json();
      })
      .then((data: string[]) => {
        const grouped: Record<string, string[]> = {};
        data.forEach((file) => {
          // Accept .json files only
          if (!file.endsWith('.json')) return;
          const year = file.split("-")[0];
          if (!grouped[year]) grouped[year] = [];
          grouped[year].push(file);
        });
        for (const year in grouped) {
          grouped[year].sort((a, b) => {
            const monthA = a.split("-")[1].replace(".json", "");
            const monthB = b.split("-")[1].replace(".json", "");
            return MONTH_ORDER.indexOf(monthA) - MONTH_ORDER.indexOf(monthB);
          });
        }
        setPatches(grouped);
      })
      .catch((e) => {
        console.error("Error loading index.json:", e);
      });
  }, []);

  // Fetch selected month's JSON from GitHub
  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetch(baseRawUrl + selected)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch ${selected}`);
        return res.json();
      })
      .then((json: PatchTuesdayData) => {
        setData(json);
        // Extract unique categories from products
        const cats = Array.from(
          new Set(Object.values(json.products).map((p) => p.category))
        ).sort();
        setCategories(cats);
        setSelectedCategory("");
        setShowSummary(true);
      })
      .catch((e) => {
        setData(null);
        setCategories([]);
        console.error("Error loading patch content:", e);
      })
      .finally(() => setLoading(false));
  }, [selected]);

  // Filter vulnerabilities by selected category
  useEffect(() => {
    if (!data) return;
    let vulns = !selectedCategory
      ? data.vulnerabilities
      : data.vulnerabilities.filter((vuln) =>
          vuln.affected_products.some((prod) => prod.category === selectedCategory)
        );
    if (cvssSort) {
      vulns = [...vulns].sort((a, b) => {
        const aScore = a.cvss_score ?? 0;
        const bScore = b.cvss_score ?? 0;
        return cvssSort === 'desc' ? bScore - aScore : aScore - bScore;
      });
    }
    setFilteredVulns(vulns);
  }, [data, selectedCategory, cvssSort]);

  // Summary statistics (like pc.py print_summary/print_statistics)
  function getSummaryStats(vulns: Vulnerability[]) {
    const total = vulns.length;
    const exploited = vulns.filter((v) => v.exploited).length;
    const likely = vulns.filter((v) => v.exploitation_likely).length;
    const cvssScores = vulns.map((v) => v.cvss_score).filter((s): s is number => s !== null);
    const high = cvssScores.filter((s) => s >= 7.0).length;
    const critical = cvssScores.filter((s) => s >= 9.0).length;
    const avg = cvssScores.length ? (cvssScores.reduce((a, b) => a + b, 0) / cvssScores.length) : 0;
    const byType = Object.fromEntries(
      VULN_TYPES.map((type) => [type, vulns.filter((v) => v.threat_types.includes(type)).length])
    );
    return { total, exploited, likely, high, critical, avg, byType };
  }

  const toggleYear = (year: string) => {
    setOpenYears((prev) => ({ ...prev, [year]: !prev[year] }));
  };

  return (
    <div className="min-h-screen bg-[#0d1117] text-green-400 font-mono p-4">
      <style>{`
          @keyframes typing {
            from { width: 0; }
            to { width: 29ch; } /* Adjust to approx the length of your title */
          }
          @keyframes blink {
            50% { border-color: transparent; }
          }
          .animate-typing {
            overflow: hidden;
            white-space: nowrap;
            border-right: 2px solid #22c55e;
            animation: typing 3s steps(31, end) forwards, blink 0.75s step-end infinite;
            width: 31ch; /* same as animation to keep caret aligned */
            margin: 0 auto 2rem; /* Add bottom margin for spacing */
          }
        `}</style>

      <h1 className="text-4xl mb-6 text-center text-green-300 animate-typing">
        Microsoft Patch Tuesday Stats
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Sidebar: Years/Months from GitHub index.json */}
        <ScrollArea className="h-[80vh] border border-green-600 p-2 rounded-xl shadow-inner bg-[#161b22]">
          {Object.keys(patches)
            .sort((a, b) => parseInt(b) - parseInt(a))
            .map((year) => (
              <div key={year} className="mb-2">
                <Button
                  variant="ghost"
                  className="w-full justify-between text-left hover:bg-green-900"
                  onClick={() => toggleYear(year)}
                >
                  {year}
                  {openYears[year] ? (
                    <span>&#9660;</span>
                  ) : (
                    <span>&#9654;</span>
                  )}
                </Button>
                {openYears[year] && (
                  <div className="ml-4 border-l border-green-800 pl-2">
                    {patches[year].map((file) => (
                      <Button
                        key={file}
                        variant="ghost"
                        className={`w-full justify-start text-left text-sm hover:bg-green-800 ${selected === file ? 'bg-green-900' : ''}`}
                        onClick={() => setSelected(file)}
                      >
                        {file.replace(".json", "")}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </ScrollArea>

        <Card className="md:col-span-3 bg-[#0f172a] text-green-300 border-[1.5px] border-green-500 rounded-xl glow-box">
          <CardContent
            className="prose prose-invert max-w-none p-6 overflow-auto scrollbar-none"
            style={{ maxHeight: '80vh', fontSize: '15px', lineHeight: '1.5' }}
            >
            {/* Summary View */}
            {loading ? (
              <div>Select a month from the left sidebar to view its Patch Tuesday updates.</div>
            ) : data ? (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl mb-2">{data.metadata.title}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                    <div>Total CVEs: <span className="font-bold">{data.metadata.total_vulnerabilities}</span></div>
                    <div>Exploited: <span className="font-bold">{getSummaryStats(filteredVulns).exploited}</span></div>
                    <div>High (≥7.0): <span className="font-bold">{getSummaryStats(filteredVulns).high}</span></div>
                    <div>Critical (≥9.0): <span className="font-bold">{getSummaryStats(filteredVulns).critical}</span></div>
                    <div>Likely Exploit: <span className="font-bold">{getSummaryStats(filteredVulns).likely}</span></div>
                    <div>Avg CVSS: <span className="font-bold">{getSummaryStats(filteredVulns).avg.toFixed(2)}</span></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {VULN_TYPES.map((type) => (
                      <div key={type}>{type}: <span className="font-bold">{getSummaryStats(filteredVulns).byType[type]}</span></div>
                    ))}
                  </div>
                </div>
                {/* Filter UI, Sort, and Summary Toggle */}
                <div className="mb-4 flex items-center gap-2">
                  <button
                    className={`px-3 py-1 rounded border font-bold ${showSummary ? 'bg-green-700 text-white border-green-600' : 'bg-[#161b22] text-green-300 border-green-600'}`}
                    onClick={() => setShowSummary(true)}
                  >
                    Show Summary
                  </button>
                  <button
                    className={`px-3 py-1 rounded border font-bold ${!showSummary ? 'bg-green-700 text-white border-green-600' : 'bg-[#161b22] text-green-300 border-green-600'}`}
                    onClick={() => setShowSummary(false)}
                  >
                    Show Table
                  </button>
                  <label htmlFor="category-select" className="text-green-400 ml-4">Filter by Category:</label>
                  <select
                    id="category-select"
                    className="bg-[#161b22] border border-green-600 rounded px-2 py-1 text-green-300"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    disabled={showSummary}
                  >
                    <option value="">All</option>
                    {categories.map((cat: string) => (
                      <option key={cat} value={cat}>{displayCategory(cat)}</option>
                    ))}
                  </select>
                  <label htmlFor="cvss-sort" className="text-green-400 ml-4">Sort by CVSS:</label>
                  <select
                    id="cvss-sort"
                    className="bg-[#161b22] border border-green-600 rounded px-2 py-1 text-green-300"
                    value={cvssSort}
                    onChange={e => setCvssSort(e.target.value as 'desc' | 'asc' | '')}
                    disabled={showSummary}
                  >
                    <option value="">None</option>
                    <option value="desc">High to Low</option>
                    <option value="asc">Low to High</option>
                  </select>
                </div>
                {/* Vulnerabilities Table or Summary */}
                {showSummary ? (
                  <SummaryView data={data} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-green-200 border-collapse">
                      <thead>
                        <tr className="border-b border-green-700">
                          <th className="px-2 py-1 text-left">CVE</th>
                          <th className="px-2 py-1 text-left">Title</th>
                          <th className="px-2 py-1">CVSS</th>
                          <th className="px-2 py-1">Severity</th>
                          <th className="px-2 py-1">Exploited</th>
                          <th className="px-2 py-1">Likely</th>
                          <th className="px-2 py-1">Threat Type</th>
                          <th className="px-2 py-1">Products</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVulns.map((vuln: Vulnerability) => (
                          <tr key={vuln.cve} className="border-b border-green-900 hover:bg-green-950/30">
                            <td className="px-2 py-1 font-mono whitespace-nowrap">
                              <a href={getCveUrl(vuln.cve, vuln.title)} target="_blank" rel="noopener noreferrer" className="underline text-green-400">{vuln.cve}</a>
                            </td>
                            <td className="px-2 py-1">{vuln.title}</td>
                            <td className="px-2 py-1 text-center">{vuln.cvss_score !== null ? vuln.cvss_score : "-"}</td>
                            <td className="px-2 py-1 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${getCvssSeverity(vuln.cvss_score) === 'Critical' ? 'bg-red-700 text-white' : getCvssSeverity(vuln.cvss_score) === 'High' ? 'bg-orange-700 text-white' : getCvssSeverity(vuln.cvss_score) === 'Medium' ? 'bg-orange-500 text-white' : getCvssSeverity(vuln.cvss_score) === 'Low' ? 'bg-yellow-300 text-black' : 'bg-gray-700 text-white'}`}>{getCvssSeverity(vuln.cvss_score)}</span>
                            </td>
                            <td className="px-2 py-1 text-center">{vuln.exploited ? "Yes" : "No"}</td>
                            <td className="px-2 py-1 text-center">{vuln.exploitation_likely ? "Yes" : "No"}</td>
                            <td className="px-2 py-1 text-center">{vuln.threat_types[0] || "-"}</td>
                            <td className="px-2 py-1 text-xs">{
                              Array.from(new Set(vuln.affected_products.map((p: { category: string }) => displayCategory(p.category)))).join(", ")
                            }</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredVulns.length === 0 && (
                      <div className="text-center text-green-400 mt-4">No vulnerabilities found for this category.</div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div>Loading Patch Tuesday data...</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- SummaryView component ---
function SummaryView({ data }: { data: PatchTuesdayData }) {
  if (!data) return null;
  const vulns = data.vulnerabilities;
  // Count by type
  const byType = Object.fromEntries(
    VULN_TYPES.map((type) => [type, vulns.filter((v) => v.threat_types.includes(type)).length])
  );
  // Exploited in the wild
  const exploited = vulns.filter((v) => v.exploited);
  // Highest rated (CVSS >= 8.0)
  const highest = vulns.filter((v) => (v.cvss_score ?? 0) >= 8.0)
    .sort((a, b) => (b.cvss_score ?? 0) - (a.cvss_score ?? 0));
  // More likely to be exploited
  const likely = vulns.filter((v) => v.exploitation_likely);
  // For alignment
  const CVE_PAD = 18;
  const SCORE_PAD = 5;
  return (
    <div className="text-green-200 text-sm space-y-4 font-mono">
      <div>[+] Found a total of <b>{vulns.length}</b> vulnerabilities</div>
      <ul className="ml-4">
        {VULN_TYPES.map((type) => (
          <li key={type}>[-] <b>{byType[type]}</b> {type} Vulnerabilities</li>
        ))}
      </ul>
      <div>[+] Found <b>{exploited.length}</b> exploited in the wild</div>
      <pre className="ml-4" style={{ whiteSpace: 'pre', fontFamily: 'inherit' }}>
        {exploited.map((v) => {
          const spaces = ' '.repeat(CVE_PAD - v.cve.length);
          const scoreStr = pad((v.cvss_score ?? "-").toString(), SCORE_PAD);
          const rest = ` - ${scoreStr} - ${v.title || 'N/A'}`;
          return (
            <span key={v.cve}>
              [-] <a href={getCveUrl(v.cve, v.title)} target="_blank" rel="noopener noreferrer" className="underline text-green-400">{v.cve}</a>{spaces}{rest}
              {'\n'}
            </span>
          );
        })}
      </pre>
      <div>[+] Highest Rated Vulnerabilities (CVSS &gt;= 8.0)</div>
      <pre className="ml-4" style={{ whiteSpace: 'pre', fontFamily: 'inherit' }}>
        {highest.map((v) => {
          const spaces = ' '.repeat(CVE_PAD - v.cve.length);
          const scoreStr = pad((v.cvss_score ?? "-").toString(), SCORE_PAD);
          const rest = ` - ${scoreStr} - ${v.title || 'N/A'}`;
          return (
            <span key={v.cve}>
              [-] <a href={getCveUrl(v.cve, v.title)} target="_blank" rel="noopener noreferrer" className="underline text-green-400">{v.cve}</a>{spaces}{rest}
              {'\n'}
            </span>
          );
        })}
      </pre>
      <div>[+] Found <b>{likely.length}</b> vulnerabilities more likely to be exploited</div>
      <pre className="ml-4" style={{ whiteSpace: 'pre', fontFamily: 'inherit' }}>
        {likely.map((v) => {
          const spaces = ' '.repeat(CVE_PAD - v.cve.length);
          const rest = ` - ${v.title || 'N/A'}`;
          return (
            <span key={v.cve}>
              [-] <a href={getCveUrl(v.cve, v.title)} target="_blank" rel="noopener noreferrer" className="underline text-green-400">{v.cve}</a>{spaces}{rest}
              {'\n'}
            </span>
          );
        })}
      </pre>
    </div>
  );
}
