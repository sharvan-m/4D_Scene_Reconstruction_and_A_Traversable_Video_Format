# Tools Overview

This folder contains utility scripts for data diagnostics, point cloud generation, and environment verification for 4D Video and Gaussian Splatting workflows.

## Utility Scripts

- **`inspect_data.py`**
  Inspects extracted video frame directories, camera poses, timestamps, and image dimensions to verify dataset formatting before 4D Gaussian Splatting training.

- **`gen_initial_ply.py`**
  Generates an initial sparse point cloud (`points3D.ply`) from sparse camera reconstructions or bounding bounds to initialize the 3D/4D Gaussian parameters.

- **`test_imports.py`**
  Performs pre-flight checks on PyTorch, CUDA device capability, and custom C++/CUDA extensions (`diff_gaussian_rasterization`, `simple_knn`, `pointops2`).

- **`vidinfo.py`**
  Extracts stream metadata, framerate, resolution, and codec information from source multi-camera video files.

## Usage
Run any tool with Python in your configured Conda environment:
```bash
python tools/inspect_data.py
python tools/test_imports.py
```
