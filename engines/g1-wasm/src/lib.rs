//! C-ABI exports matching eve-fit-web's wasm worker (src/engine/worker.ts):
//!   alloc(len) -> ptr, dealloc(ptr, len), init(ptr, len) [dataset .json.gz bytes] -> u64 (ptr<<32|len of a JSON status),
//!   calc(ptr, len) -> u64 (FitStats JSON), rpc(ptr, len) -> u64 ({"id","result"|"error"}; methods calc, graph,
//!   graph_specs, eft_parse, eft_export, search, type, meta).
//! Unlike variant F the dataset is not compiled in: the worker fetches it and passes it to `init`.
use eve_dogma_e::{api, data::Dataset, graphs};
use serde_json::{json, Value};
use std::io::Read;
use std::sync::OnceLock;

static DS: OnceLock<Dataset> = OnceLock::new();

const GRAPHS: &[&str] = &["damage", "application_profile", "ewar", "remote_reps", "capacitor", "shield_regen", "mobility", "warp_time", "lock_time", "ecm_burst"];

#[unsafe(no_mangle)]
pub extern "C" fn alloc(len: usize) -> *mut u8 {
    let mut v = Vec::<u8>::with_capacity(len.max(1));
    let p = v.as_mut_ptr();
    std::mem::forget(v);
    p
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn dealloc(ptr: *mut u8, len: usize) {
    unsafe { drop(Vec::from_raw_parts(ptr, 0, len.max(1))) };
}

fn ret(s: String) -> u64 {
    let b = s.into_bytes().into_boxed_slice();
    let len = b.len();
    let p = Box::into_raw(b) as *mut u8;
    // dealloc(p, len) frees it: a boxed slice of len bytes has capacity len (min 1 handled by alloc semantics)
    let p = if len == 0 { let q = alloc(1); q } else { p };
    ((p as u64) << 32) | len as u64
}

unsafe fn input(ptr: *const u8, len: usize) -> &'static [u8] {
    unsafe { std::slice::from_raw_parts(ptr, len) }
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn init(ptr: *const u8, len: usize) -> u64 {
    let bytes = unsafe { input(ptr, len) };
    let mut js = Vec::new();
    let r = if bytes.starts_with(&[0x1f, 0x8b]) {
        flate2::read::GzDecoder::new(bytes).read_to_end(&mut js).map(|_| ()).map_err(|e| format!("gunzip: {e}"))
    } else {
        js.extend_from_slice(bytes);
        Ok(())
    };
    let out = match r.and_then(|_| Dataset::from_json(&js)) {
        Ok(ds) => { let _ = DS.set(ds); json!({"ok": true, "meta": meta()}) }
        Err(e) => json!({"error": {"code": "DATASET", "message": e}}),
    };
    ret(out.to_string())
}

fn meta() -> Value {
    json!({"engine": "eve-dogma-e (graphs-g1, wasm)", "sde_build": DS.get().map(|d| json!(d.build)).unwrap_or(Value::Null)})
}

fn specs() -> Value {
    // variant-e has no graph_specs method; the graph types are the contract's (CONTRACT-GRAPHS rev 0.2).
    json!({"contract": "CONTRACT-GRAPHS.md revision 0.2 (graphs-g1)", "graphs": GRAPHS.iter().map(|g| (g.to_string(), json!({}))).collect::<serde_json::Map<_, _>>()})
}

fn ser<T: serde::Serialize>(v: &T) -> Value { serde_json::to_value(v).unwrap_or(Value::Null) }

#[unsafe(no_mangle)]
pub unsafe extern "C" fn calc(ptr: *const u8, len: usize) -> u64 {
    let Some(ds) = DS.get() else { return ret(json!({"error": {"code": "NOT_INITIALISED", "message": "call init first"}}).to_string()) };
    let s = String::from_utf8_lossy(unsafe { input(ptr, len) });
    ret(serde_json::to_string(&api::calc_str(ds, &s)).unwrap_or_default())
}

#[unsafe(no_mangle)]
pub unsafe extern "C" fn rpc(ptr: *const u8, len: usize) -> u64 {
    let s = String::from_utf8_lossy(unsafe { input(ptr, len) });
    let r: Value = match serde_json::from_str(&s) {
        Ok(v) => v,
        Err(e) => return ret(json!({"id": null, "error": {"code": "BAD_JSON", "message": e.to_string()}}).to_string()),
    };
    let id = r.get("id").cloned().unwrap_or(Value::Null);
    let Some(ds) = DS.get() else { return ret(json!({"id": id, "error": {"code": "NOT_INITIALISED", "message": "call init first"}}).to_string()) };
    let params = r.get("params").cloned().unwrap_or(Value::Null);
    let res: Value = match r.get("method").and_then(|m| m.as_str()).unwrap_or("calc") {
        "calc" => ser(&api::calc_value(ds, params)),
        "graph" => graphs::graph_value(ds, params),
        "graph_specs" => specs(),
        "eft_parse" => ser(&api::eft_parse_value(ds, &params)),
        "eft_export" => ser(&api::eft_export_value(ds, params)),
        "search" => ser(&api::search_value(ds, &params)),
        "type" => ser(&api::type_value(ds, &params)),
        "meta" => meta(),
        m => json!({"error": {"code": "UNKNOWN_METHOD", "message": m}}),
    };
    ret(json!({"id": id, "result": res}).to_string())
}
