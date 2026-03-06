# Implementation Plan - Parametric Architecture Engine

This plan outlines the development of a Parametric Architecture Engine focused on Floor Plan Generation and Real-time Code Compliance (Egyptian Building Code).

## Phase 1: Core Geometry Pipeline (Current Focus)
- [ ] Define the `Spine` class to handle input polylines.
- [ ] Implement `Corridor` generation with bilateral offsets.
- [ ] Develop `CornerResolution` (Pivot Core) logic for L and U shapes.
- [ ] Implement `RoomSubdivision` logic based on width and depth parameters.

## Phase 2: Data Extraction & Smart Objects
- [ ] Implement Area calculation for room surfaces.
- [ ] Implement Minimum Dimension (Width) calculation.
- [ ] Develop Edge Adjacency/Ventilation detection (Exterior/Void proximity).

## Phase 3: Visual Feedback & Validator
- [ ] Create the `Validator` node logic.
- [ ] Implement Area/Width violation styling (Solid Stroke, Inverted Color, Dynamic Weight).
- [ ] Implement Ventilation violation styling (Dashed Stroke).

## Phase 4: UI/UX (Side Panel & Error Handling)
- [ ] Design the Side Panel for errors and warnings.
- [ ] Implement clickable resolution options (Merge, Trim, Shift).
- [ ] Ensure "Architectural Mode ONLY" constraints are strictly followed.
