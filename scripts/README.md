# Scripts Directory Overview

This directory contains shell and batch scripts organized by workflow stages for building CUDA extensions, training 4D Gaussian Splatting models, preprocessing camera poses/videos, and running system diagnostics.

## Organization

### 1. `build/`
Scripts dedicated to building custom CUDA and C++ PyTorch extensions required by the 4DGS pipeline:
- `build_knn.bat`: Compiles the `simple-knn` extension with MSVC build tools.
- `build_rest.bat`: Compiles supporting pointops and differential rasterization components.
- `clean_build_dgr.bat`: Cleans old cached artifacts and rebuilds `diff-gaussian-rasterization`.

### 2. `training/`
Scripts for launching and monitoring 4DGS optimization jobs:
- `run_train.bat`: Standard training execution script.
- `run_train4.bat`: 4DGS multi-view training.
- `run_train4_resume.bat`: Resume training from a specific iteration or checkpoint.
- `run_train_ours.bat` / `run_train_ours_hr.bat` / `run_train_ours_hr2.bat`: Training scripts calibrated for custom multi-view video captures at normal and high resolutions.
- `run_train_n3v_fast.bat` / `run_train_n3v_resume.bat`: Fast profiles and resume scripts for Neural 3D Video (N3V) benchmark datasets.
- `run_ours10s.bat` / `run_n3v10s.bat`: 10-second bounded runs for fast verification and benchmarking.

### 3. `preprocessing/`
Scripts for preparing frames, camera parameters, and scene exports:
- `run_preprocess.bat`: Automates frame extraction, timestamp mapping, and initial point estimation.
- `finish_n3v10s.bat`: Post-processing script packaging rendered models into `.4dv` containers.

### 4. `diagnostics/`
Environment, GPU, and dependency health checks:
- `check_colmap.bat`: Validates COLMAP dependencies and dynamic link library availability.
- `test_imports.bat`: Runs JIT compilation and PyTorch CUDA import validation.
- `run_sanitizer.bat`: Runs NVIDIA Compute Sanitizer to detect memory errors in CUDA kernels.
- `run_py.bat`: Wrapper executing Python commands with verified MSVC and CUDA environment variables.
- `watch_n3v.ps1`: PowerShell log monitor tracking live training progress and iteration metrics.
