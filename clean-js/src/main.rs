#![deny(warnings)]
#![warn(unused_extern_crates)]
#![deny(clippy::todo)]
#![deny(clippy::unimplemented)]
#![deny(clippy::unwrap_used)]
#![deny(clippy::expect_used)]
#![deny(clippy::panic)]
#![deny(clippy::unreachable)]
#![deny(clippy::await_holding_lock)]
#![deny(clippy::needless_pass_by_value)]
#![deny(clippy::trivially_copy_pass_by_ref)]
#![deny(unsafe_code)]

use std::{io, path::PathBuf, process::ExitCode};

use clap::Parser;
use rayon::prelude::*;

#[derive(Parser)]
struct CLiOpts {
    pub directory: Option<String>,
}

const PREFIXES: [&str; 3] = [".pnpm", ".node_modules", "node_modules"];

fn check_dir(dir: &PathBuf) -> Result<Vec<PathBuf>, Box<dyn std::error::Error>> {
    if !dir.exists() {
        return Err(io::Error::other(format!(
            "Directory does not exist but was given to check_dir: {}",
            dir.display()
        ))
        .into());
    }

    if !dir.is_dir() {
        return Err(io::Error::other(format!(
            "Path is not a directory but was given to check_dir: {}",
            dir.display()
        ))
        .into());
    }

    let entries = std::fs::read_dir(dir)?.collect::<Result<Vec<_>, _>>()?;
    let entries = entries
        .par_iter()
        .filter_map(|entry| {
            if !entry.path().is_dir() {
                return None;
            }
            if PREFIXES
                .iter()
                .any(|prefix| entry.file_name().to_string_lossy().starts_with(prefix))
            {
                eprintln!("Found directory: {}", entry.path().display());
                return Some(vec![entry.path()]);
            }
            check_dir(&entry.path()).ok()
        })
        .collect::<Vec<_>>()
        .into_iter()
        .flatten()
        .collect::<Vec<_>>();
    Ok(entries)
}

fn main() -> ExitCode {
    let opts = CLiOpts::parse();
    let target_dir = shellexpand::tilde(&opts.directory.unwrap_or("./".to_string())).to_string();
    let target_dir = match PathBuf::from(target_dir).canonicalize() {
        Ok(dir) => dir,
        Err(err) => {
            eprintln!("Failed to canonicalize path: {}", err);
            return ExitCode::FAILURE;
        }
    };

    eprintln!("Checking directory: {}", target_dir.display());
    let results = match check_dir(&target_dir) {
        Ok(results) => results,
        Err(err) => {
            eprintln!("Error: {}", err);
            return ExitCode::FAILURE;
        }
    };
    println!("Found {} directories:", results.len());

    dialoguer::MultiSelect::new()
        .with_prompt("Select directories to delete")
        .items(
            results
                .iter()
                .map(|dir| dir.display().to_string())
                .collect::<Vec<_>>(),
        )
        .interact()
        .unwrap_or_else(|err| {
            eprintln!("Error: {}", err);
            std::process::exit(1);
        })
        .into_iter()
        .for_each(|index| {
            let dir = &results[index];
            if !dir.exists() {
                eprintln!("Directory does not exist at delete time: {}", dir.display());
                return;
            }
            eprintln!("Deleting directory: {}", dir.display());
            std::fs::remove_dir_all(dir).unwrap_or_else(|err| {
                eprintln!("Error deleting directory {}: {}", dir.display(), err);
                std::process::exit(1);
            });
        });
    ExitCode::SUCCESS
}
