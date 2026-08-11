use std::process::ExitCode;

use clap::Parser;
use hollowbyte::{Cli, run};

fn main() -> ExitCode {
    let cli = Cli::parse();

    match run(&cli) {
        Ok(report) => {
            println!("{report}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("error: {error}");
            ExitCode::FAILURE
        }
    }
}
