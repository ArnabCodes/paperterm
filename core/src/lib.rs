use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Deserialize)]
pub struct Line {
    text: String,
    page: u32,
    x: f64,
    y: f64,
}

#[derive(Deserialize)]
pub struct Request {
    lines: Vec<Line>,
    query: String,
    kind: String,
}

#[derive(Serialize, Debug)]
pub struct Hit {
    text: String,
    label: String,
    kind: String,
    page: u32,
    x: f64,
    y: f64,
    score: u32,
}

fn patterns() -> &'static [Regex; 3] {
    static PATTERNS: OnceLock<[Regex; 3]> = OnceLock::new();
    PATTERNS.get_or_init(|| [
        Regex::new(r"\(((?:[A-Z]\.?)?\d+(?:[.\-]\d+)*[a-z]?)\)\s*$").unwrap(),
        Regex::new(r"^\s*\[([^\]]{1,36})\]\s*(.*)").unwrap(),
        Regex::new(r"(?i)^\s*((?:Figure|Fig\.?|Table)\s+\d+(?:[.\-]\d+)*)\b").unwrap(),
    ])
}

pub fn lookup(request: Request) -> Vec<Hit> {
    let query = request.query.trim().to_lowercase();
    let identifier = query.trim_matches(|character: char| "()[]".contains(character));
    let mut hits = Vec::new();
    for line in request.lines {
        let trimmed = line.text.trim();
        let lower = trimmed.to_lowercase();
        for (index, pattern) in patterns().iter().enumerate() {
            let kind = ["equation", "citation", "figure"][index];
            if request.kind != "all" && request.kind != kind {
                continue;
            }
            let Some(captures) = pattern.captures(trimmed) else { continue };
            let label = captures.get(1).unwrap().as_str().to_string();
            let label_lower = label.to_lowercase();
            if !identifier.is_empty() && !identifier.split_whitespace().all(|token| lower.contains(token)) {
                continue;
            }
            let mut score: u32 = 20;
            if !identifier.is_empty() && (label_lower == identifier || (kind == "figure" && label_lower.split_whitespace().last() == Some(identifier))) {
                score += 100;
            }
            if kind == "equation" {
                if trimmed == format!("({label})") || line.x > 0.65 {
                    score += 70;
                } else if lower.starts_with("see ") || lower.contains("equation") || lower.contains("eq.") {
                    score = score.saturating_sub(15);
                } else {
                    score += 30;
                }
            } else if kind == "citation" {
                score += if captures.get(2).is_some_and(|capture| capture.as_str().len() > 15) { 70 } else { 0 };
            } else {
                score += 50;
            }
            hits.push(Hit { text: trimmed.to_string(), label, kind: kind.into(), page: line.page, x: line.x, y: line.y, score });
        }
    }
    hits.sort_by(|left, right| right.score.cmp(&left.score).then(left.page.cmp(&right.page)).then(left.y.total_cmp(&right.y)));
    hits.truncate(200);
    hits
}

#[no_mangle]
pub extern "C" fn allocate(length: usize) -> *mut u8 {
    Box::into_raw(vec![0u8; length].into_boxed_slice()) as *mut u8
}

#[no_mangle]
pub unsafe extern "C" fn release(pointer: *mut u8, length: usize) {
    drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(pointer, length)));
}

#[no_mangle]
pub unsafe extern "C" fn run_lookup(pointer: *const u8, length: usize) -> u64 {
    let input = std::slice::from_raw_parts(pointer, length);
    let result = match serde_json::from_slice::<Request>(input) {
        Ok(request) => serde_json::to_vec(&lookup(request)).unwrap_or_else(|_| b"[]".to_vec()),
        Err(_) => b"[]".to_vec(),
    };
    let output = result.into_boxed_slice();
    let output_length = output.len() as u64;
    let output_pointer = Box::into_raw(output) as *mut u8 as u64;
    (output_pointer << 32) | output_length
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(text: &str, page: u32, x: f64) -> Line {
        Line { text: text.into(), page, x, y: 0.5 }
    }

    #[test]
    fn ranks_definition_above_mention_and_partial_number() {
        let hits = lookup(Request { lines: vec![line("See equation (2)", 1, 0.1), line("(12)", 2, 0.8), line("(2)", 3, 0.8)], query: "(2)".into(), kind: "equation".into() });
        assert_eq!(hits[0].page, 3);
        assert_eq!(hits[0].label, "2");
    }

    #[test]
    fn citation_author_search_handles_unicode_and_keeps_source() {
        let hits = lookup(Request { lines: vec![line("[7] Schrödinger, E. Quantisation as an eigenvalue problem.", 9, 0.1)], query: "schrödinger".into(), kind: "citation".into() });
        assert_eq!(hits[0].label, "7");
        assert_eq!(hits[0].page, 9);
    }

    #[test]
    fn category_filter_does_not_return_equations_for_citations() {
        let hits = lookup(Request { lines: vec![line("(7)", 2, 0.8), line("[7] A. Author. A reference entry.", 8, 0.1)], query: "7".into(), kind: "citation".into() });
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].page, 8);
    }

    #[test]
    fn appendix_and_figure_labels_are_preserved() {
        let hits = lookup(Request { lines: vec![line("(A.2)", 1, 0.8), line("(A2)", 2, 0.8), line("Figure 2.3. A useful diagram", 3, 0.1)], query: String::new(), kind: "figure".into() });
        assert_eq!(hits[0].label, "Figure 2.3");
    }

    #[test]
    fn exact_figure_number_precedes_partial_matches() {
        let hits = lookup(Request { lines: vec![line("Figure 10. Earlier caption", 1, 0.1), line("Figure 1. Exact caption", 8, 0.1)], query: "1".into(), kind: "figure".into() });
        assert_eq!(hits[0].page, 8);
    }
}
