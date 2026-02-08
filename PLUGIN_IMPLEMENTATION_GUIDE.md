# Revit MCP Plugin Implementation Guide

This guide provides C# implementation patterns for all 22 new command handlers that need to be added to the `revit-mcp-plugin` source code.

## Setup

All command handlers should:
1. Inherit from the base command handler class
2. Implement transaction-based operations
3. Handle errors gracefully with try-catch
4. Return JSON responses matching the expected format
5. Use millimeters (mm) for all coordinate conversions

---

## 1. View Management Commands

### create_view

```csharp
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using System;
using System.Linq;

public class CreateViewCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        using (Transaction trans = new Transaction(doc, "Create View"))
        {
            trans.Start();
            try
            {
                View newView = null;
                string viewType = data.viewType;
                string viewName = data.viewName;
                
                switch (viewType)
                {
                    case "FloorPlan":
                        var levelId = new ElementId((int)data.levelId);
                        var level = doc.GetElement(levelId) as Level;
                        var floorPlanType = doc.GetElement(
                            ViewFamilyType.GetViewFamilyTypes(doc)
                            .FirstOrDefault(x => x.ViewFamily == ViewFamily.FloorPlan)
                        ) as ViewFamilyType;
                        newView = ViewPlan.Create(doc, floorPlanType.Id, levelId);
                        break;
                        
                    case "CeilingPlan":
                        levelId = new ElementId((int)data.levelId);
                        var ceilingPlanType = doc.GetElement(
                            ViewFamilyType.GetViewFamilyTypes(doc)
                            .FirstOrDefault(x => x.ViewFamily == ViewFamily.CeilingPlan)
                        ) as ViewFamilyType;
                        newView = ViewPlan.Create(doc, ceilingPlanType.Id, levelId);
                        break;
                        
                    case "Section":
                        var sectionType = doc.GetElement(
                            ViewFamilyType.GetViewFamilyTypes(doc)
                            .FirstOrDefault(x => x.ViewFamily == ViewFamily.Section)
                        ) as ViewFamilyType;
                        
                        // Default section box - adjust based on project
                        BoundingBoxXYZ sectionBox = new BoundingBoxXYZ();
                        sectionBox.Min = new XYZ(-50, 0, 0);
                        sectionBox.Max = new XYZ(50, 100, 50);
                        
                        newView = ViewSection.CreateSection(doc, sectionType.Id, sectionBox);
                        break;
                        
                    case "ThreeD":
                        var view3DType = doc.GetElement(
                            ViewFamilyType.GetViewFamilyTypes(doc)
                            .FirstOrDefault(x => x.ViewFamily == ViewFamily.ThreeDimensional)
                        ) as ViewFamilyType;
                        
                        newView = View3D.CreateIsometric(doc, view3DType.Id);
                        
                        if (data.isPerspective != null && (bool)data.isPerspective)
                        {
                            newView = View3D.CreatePerspective(doc, view3DType.Id);
                        }
                        
                        // Set section box if provided
                        if (data.sectionBox != null)
                        {
                            var view3D = newView as View3D;
                            var bbox = new BoundingBoxXYZ();
                            bbox.Min = new XYZ(
                                (double)data.sectionBox.min.x / 304.8,
                                (double)data.sectionBox.min.y / 304.8,
                                (double)data.sectionBox.min.z / 304.8
                            );
                            bbox.Max = new XYZ(
                                (double)data.sectionBox.max.x / 304.8,
                                (double)data.sectionBox.max.y / 304.8,
                                (double)data.sectionBox.max.z / 304.8
                            );
                            view3D.SetSectionBox(bbox);
                        }
                        break;
                        
                    case "DraftingView":
                        var draftingType = doc.GetElement(
                            ViewFamilyType.GetViewFamilyTypes(doc)
                            .FirstOrDefault(x => x.ViewFamily == ViewFamily.Drafting)
                        ) as ViewFamilyType;
                        newView = ViewDrafting.Create(doc, draftingType.Id);
                        break;
                }
                
                if (newView != null)
                {
                    newView.Name = viewName;
                    
                    // Set scale if provided
                    if (data.scale != null)
                    {
                        newView.Scale = (int)data.scale;
                    }
                    
                    // Set detail level if provided
                    if (data.detailLevel != null)
                    {
                        string detailLevel = data.detailLevel;
                        ViewDetailLevel level = ViewDetailLevel.Medium;
                        if (detailLevel == "Coarse") level = ViewDetailLevel.Coarse;
                        else if (detailLevel == "Fine") level = ViewDetailLevel.Fine;
                        newView.DetailLevel = level;
                    }
                    
                    // Apply view template if provided
                    if (data.viewTemplateId != null)
                    {
                        newView.ViewTemplateId = new ElementId((int)data.viewTemplateId);
                    }
                }
                
                trans.Commit();
                
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = true,
                    viewId = newView.Id.IntegerValue,
                    viewName = newView.Name,
                    viewType = viewType
                });
            }
            catch (Exception ex)
            {
                trans.RollBack();
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }
    }
}
```

### duplicate_view

```csharp
public class DuplicateViewCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        using (Transaction trans = new Transaction(doc, "Duplicate View"))
        {
            trans.Start();
            try
            {
                var viewId = new ElementId((int)data.viewId);
                var view = doc.GetElement(viewId) as View;
                string newViewName = data.newViewName;
                string duplicateOption = data.duplicateOption ?? "Duplicate";
                
                ViewDuplicateOption option = ViewDuplicateOption.Duplicate;
                if (duplicateOption == "WithDetailing")
                    option = ViewDuplicateOption.WithDetailing;
                else if (duplicateOption == "AsDependent")
                    option = ViewDuplicateOption.AsDependent;
                
                ElementId newViewId = view.Duplicate(option);
                View newView = doc.GetElement(newViewId) as View;
                newView.Name = newViewName;
                
                trans.Commit();
                
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = true,
                    originalViewId = viewId.IntegerValue,
                    newViewId = newViewId.IntegerValue,
                    newViewName = newView.Name
                });
            }
            catch (Exception ex)
            {
                trans.RollBack();
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }
    }
}
```

### set_view_properties

```csharp
public class SetViewPropertiesCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        using (Transaction trans = new Transaction(doc, "Set View Properties"))
        {
            trans.Start();
            try
            {
                var viewId = new ElementId((int)data.viewId);
                var view = doc.GetElement(viewId) as View;
                
                if (data.scale != null)
                {
                    view.Scale = (int)data.scale;
                }
                
                if (data.detailLevel != null)
                {
                    string detailLevel = data.detailLevel;
                    ViewDetailLevel level = ViewDetailLevel.Medium;
                    if (detailLevel == "Coarse") level = ViewDetailLevel.Coarse;
                    else if (detailLevel == "Fine") level = ViewDetailLevel.Fine;
                    view.DetailLevel = level;
                }
                
                if (data.viewTemplateId != null)
                {
                    int templateId = (int)data.viewTemplateId;
                    view.ViewTemplateId = templateId == -1 ? 
                        ElementId.InvalidElementId : new ElementId(templateId);
                }
                
                if (data.cropBoxVisible != null)
                {
                    view.CropBoxVisible = (bool)data.cropBoxVisible;
                }
                
                if (data.annotationCropActive != null)
                {
                    view.CropBoxActive = (bool)data.annotationCropActive;
                }
                
                if (data.cropRegion != null)
                {
                    var cropManager = view.GetCropRegionShapeManager();
                    var curveLoop = new CurveLoop();
                    
                    double minX = (double)data.cropRegion.min.x / 304.8;
                    double minY = (double)data.cropRegion.min.y / 304.8;
                    double maxX = (double)data.cropRegion.max.x / 304.8;
                    double maxY = (double)data.cropRegion.max.y / 304.8;
                    
                    curveLoop.Append(Line.CreateBound(
                        new XYZ(minX, minY, 0), new XYZ(maxX, minY, 0)));
                    curveLoop.Append(Line.CreateBound(
                        new XYZ(maxX, minY, 0), new XYZ(maxX, maxY, 0)));
                    curveLoop.Append(Line.CreateBound(
                        new XYZ(maxX, maxY, 0), new XYZ(minX, maxY, 0)));
                    curveLoop.Append(Line.CreateBound(
                        new XYZ(minX, maxY, 0), new XYZ(minX, minY, 0)));
                    
                    cropManager.SetCropShape(curveLoop);
                }
                
                if (data.displayStyle != null)
                {
                    string displayStyle = data.displayStyle;
                    DisplayStyle style = DisplayStyle.HLR;
                    switch (displayStyle)
                    {
                        case "Wireframe": style = DisplayStyle.Wireframe; break;
                        case "HiddenLine": style = DisplayStyle.HLR; break;
                        case "Shaded": style = DisplayStyle.Shading; break;
                        case "Realistic": style = DisplayStyle.Realistic; break;
                    }
                    view.DisplayStyle = style;
                }
                
                trans.Commit();
                
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = true,
                    viewId = viewId.IntegerValue,
                    message = "View properties updated successfully"
                });
            }
            catch (Exception ex)
            {
                trans.RollBack();
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }
    }
}
```

### get_views_list

```csharp
public class GetViewsListCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        try
        {
            FilteredElementCollector collector = new FilteredElementCollector(doc)
                .OfClass(typeof(View));
            
            bool includeTemplates = data.includeTemplates ?? false;
            if (!includeTemplates)
            {
                collector = collector.Cast<View>()
                    .Where(v => !v.IsTemplate)
                    .ToFilteredElementCollector(doc);
            }
            
            var views = collector.Cast<View>()
                .Select(v => new
                {
                    id = v.Id.IntegerValue,
                    name = v.Name,
                    viewType = v.ViewType.ToString(),
                    isTemplate = v.IsTemplate,
                    levelId = v.GenLevel?.Id.IntegerValue,
                    levelName = v.GenLevel?.Name,
                    scale = v.Scale
                })
                .ToList();
            
            // Filter by viewType if specified
            if (data.viewType != null && data.viewType != "All")
            {
                string filterType = data.viewType;
                views = views.Where(v => v.viewType == filterType).ToList();
            }
            
            // Filter by name if specified
            if (data.searchName != null)
            {
                string searchName = ((string)data.searchName).ToLower();
                views = views.Where(v => v.name.ToLower().Contains(searchName)).ToList();
            }
            
            return Newtonsoft.Json.JsonConvert.SerializeObject(new
            {
                success = true,
                count = views.Count,
                views = views
            });
        }
        catch (Exception ex)
        {
            return Newtonsoft.Json.JsonConvert.SerializeObject(new
            {
                success = false,
                error = ex.Message
            });
        }
    }
}
```

---

## 2. Sheet Management Commands

### create_sheet

```csharp
public class CreateSheetCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        using (Transaction trans = new Transaction(doc, "Create Sheet"))
        {
            trans.Start();
            try
            {
                string sheetNumber = data.sheetNumber;
                string sheetName = data.sheetName;
                bool isPlaceholder = data.placeholderSheet ?? false;
                
                ViewSheet newSheet = null;
                
                if (isPlaceholder)
                {
                    newSheet = ViewSheet.CreatePlaceholder(doc);
                }
                else
                {
                    ElementId titleBlockId = ElementId.InvalidElementId;
                    
                    if (data.titleBlockTypeId != null)
                    {
                        titleBlockId = new ElementId((int)data.titleBlockTypeId);
                    }
                    else
                    {
                        // Find first available titleblock
                        var titleBlock = new FilteredElementCollector(doc)
                            .OfCategory(BuiltInCategory.OST_TitleBlocks)
                            .WhereElementIsElementType()
                            .FirstOrDefault();
                        
                        if (titleBlock != null)
                            titleBlockId = titleBlock.Id;
                    }
                    
                    newSheet = ViewSheet.Create(doc, titleBlockId);
                }
                
                newSheet.SheetNumber = sheetNumber;
                newSheet.Name = sheetName;
                
                trans.Commit();
                
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = true,
                    sheetId = newSheet.Id.IntegerValue,
                    sheetNumber = newSheet.SheetNumber,
                    sheetName = newSheet.Name
                });
            }
            catch (Exception ex)
            {
                trans.RollBack();
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }
    }
}
```

### place_viewport

```csharp
public class PlaceViewportCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        using (Transaction trans = new Transaction(doc, "Place Viewport"))
        {
            trans.Start();
            try
            {
                var sheetId = new ElementId((int)data.sheetId);
                var viewId = new ElementId((int)data.viewId);
                var sheet = doc.GetElement(sheetId) as ViewSheet;
                var view = doc.GetElement(viewId) as View;
                
                // Convert mm to feet
                XYZ location = new XYZ(
                    (double)data.location.x / 304.8,
                    (double)data.location.y / 304.8,
                    0
                );
                
                // Check if view can be placed on sheet
                if (!Viewport.CanAddViewToSheet(doc, sheetId, viewId))
                {
                    throw new Exception("View cannot be placed on this sheet. It may already be on another sheet.");
                }
                
                Viewport viewport = Viewport.Create(doc, sheetId, viewId, location);
                
                if (data.viewportTypeId != null)
                {
                    viewport.ChangeTypeId(new ElementId((int)data.viewportTypeId));
                }
                
                trans.Commit();
                
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = true,
                    viewportId = viewport.Id.IntegerValue,
                    sheetId = sheetId.IntegerValue,
                    viewId = viewId.IntegerValue
                });
            }
            catch (Exception ex)
            {
                trans.RollBack();
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }
    }
}
```

### get_sheets_list

```csharp
public class GetSheetsListCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        try
        {
            var sheets = new FilteredElementCollector(doc)
                .OfClass(typeof(ViewSheet))
                .Cast<ViewSheet>()
                .Where(s => !s.IsTemplate)
                .Select(s => new
                {
                    id = s.Id.IntegerValue,
                    sheetNumber = s.SheetNumber,
                    sheetName = s.Name,
                    isPlaceholder = s.IsPlaceholder,
                    viewportCount = s.GetAllViewports().Count
                })
                .ToList();
            
            bool includePlaceholders = data.includePlaceholders ?? false;
            if (!includePlaceholders)
            {
                sheets = sheets.Where(s => !s.isPlaceholder).ToList();
            }
            
            if (data.searchNumber != null)
            {
                string searchNumber = ((string)data.searchNumber).ToLower();
                sheets = sheets.Where(s => s.sheetNumber.ToLower().Contains(searchNumber)).ToList();
            }
            
            if (data.searchName != null)
            {
                string searchName = ((string)data.searchName).ToLower();
                sheets = sheets.Where(s => s.sheetName.ToLower().Contains(searchName)).ToList();
            }
            
            return Newtonsoft.Json.JsonConvert.SerializeObject(new
            {
                success = true,
                count = sheets.Count,
                sheets = sheets
            });
        }
        catch (Exception ex)
        {
            return Newtonsoft.Json.JsonConvert.SerializeObject(new
            {
                success = false,
                error = ex.Message
            });
        }
    }
}
```

---

## 3. Annotation Commands

### create_dimension

```csharp
public class CreateDimensionCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        using (Transaction trans = new Transaction(doc, "Create Dimension"))
        {
            trans.Start();
            try
            {
                var viewId = new ElementId((int)data.viewId);
                var view = doc.GetElement(viewId) as View;
                
                // Create reference array
                ReferenceArray refArray = new ReferenceArray();
                
                foreach (var refData in data.references)
                {
                    var elementId = new ElementId((int)refData.elementId);
                    var element = doc.GetElement(elementId);
                    
                    // Get reference from element face or edge
                    GeometryObject geomObj = element.get_Geometry(new Options())
                        .FirstOrDefault();
                    
                    if (geomObj != null && geomObj is Solid solid)
                    {
                        foreach (Face face in solid.Faces)
                        {
                            refArray.Append(face.Reference);
                            break; // Use first face
                        }
                    }
                }
                
                // Create dimension line
                XYZ origin = new XYZ(
                    (double)data.dimensionLine.origin.x / 304.8,
                    (double)data.dimensionLine.origin.y / 304.8,
                    (double)data.dimensionLine.origin.z / 304.8
                );
                
                XYZ direction = new XYZ(
                    (double)data.dimensionLine.direction.x,
                    (double)data.dimensionLine.direction.y,
                    (double)data.dimensionLine.direction.z
                ).Normalize();
                
                Line dimLine = Line.CreateBound(origin, origin + direction * 10);
                
                Dimension dimension = doc.Create.NewDimension(view, dimLine, refArray);
                
                trans.Commit();
                
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = true,
                    dimensionId = dimension.Id.IntegerValue,
                    value = dimension.ValueString
                });
            }
            catch (Exception ex)
            {
                trans.RollBack();
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }
    }
}
```

### create_tag

```csharp
public class CreateTagCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        using (Transaction trans = new Transaction(doc, "Create Tag"))
        {
            trans.Start();
            try
            {
                var viewId = new ElementId((int)data.viewId);
                var view = doc.GetElement(viewId) as View;
                var elementId = new ElementId((int)data.elementId);
                var element = doc.GetElement(elementId);
                
                bool hasLeader = data.hasLeader ?? false;
                
                XYZ location;
                if (data.location != null)
                {
                    location = new XYZ(
                        (double)data.location.x / 304.8,
                        (double)data.location.y / 304.8,
                        (double)data.location.z / 304.8
                    );
                }
                else
                {
                    // Use element location
                    var locationPoint = (element.Location as LocationPoint);
                    location = locationPoint != null ? locationPoint.Point : XYZ.Zero;
                }
                
                // Determine tag mode
                TagMode tagMode = TagMode.TM_ADDBY_CATEGORY;
                TagOrientation tagOrientation = TagOrientation.Horizontal;
                
                if (data.tagMode != null)
                {
                    string mode = data.tagMode;
                    if (mode == "Vertical") tagOrientation = TagOrientation.Vertical;
                }
                
                IndependentTag tag = IndependentTag.Create(
                    doc, 
                    view.Id, 
                    new Reference(element), 
                    hasLeader, 
                    tagMode, 
                    tagOrientation, 
                    location
                );
                
                if (data.tagTypeId != null)
                {
                    tag.ChangeTypeId(new ElementId((int)data.tagTypeId));
                }
                
                trans.Commit();
                
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = true,
                    tagId = tag.Id.IntegerValue,
                    tagText = tag.TagText
                });
            }
            catch (Exception ex)
            {
                trans.RollBack();
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }
    }
}
```

### batch_tag_elements

```csharp
public class BatchTagElementsCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        using (Transaction trans = new Transaction(doc, "Batch Tag Elements"))
        {
            trans.Start();
            try
            {
                var viewId = new ElementId((int)data.viewId);
                var view = doc.GetElement(viewId) as View;
                
                List<Element> elementsToTag = new List<Element>();
                
                if (data.elementIds != null && ((IEnumerable<dynamic>)data.elementIds).Any())
                {
                    foreach (var id in data.elementIds)
                    {
                        var element = doc.GetElement(new ElementId((int)id));
                        if (element != null) elementsToTag.Add(element);
                    }
                }
                else
                {
                    // Get all taggable elements in view
                    var collector = new FilteredElementCollector(doc, viewId)
                        .WhereElementIsNotElementType();
                    
                    if (data.categoryFilter != null && ((IEnumerable<dynamic>)data.categoryFilter).Any())
                    {
                        var categories = new List<BuiltInCategory>();
                        foreach (var cat in data.categoryFilter)
                        {
                            BuiltInCategory builtInCat;
                            if (Enum.TryParse((string)cat, out builtInCat))
                            {
                                categories.Add(builtInCat);
                            }
                        }
                        
                        collector = collector.WherePasses(
                            new LogicalOrFilter(categories.Select(c => 
                                new ElementCategoryFilter(c) as ElementFilter).ToList())
                        );
                    }
                    
                    elementsToTag = collector.ToElements().ToList();
                }
                
                bool hasLeader = data.hasLeader ?? false;
                bool skipExisting = data.skipExistingTags ?? true;
                TagOrientation tagOrientation = TagOrientation.Horizontal;
                
                if (data.tagMode == "Vertical")
                    tagOrientation = TagOrientation.Vertical;
                
                int taggedCount = 0;
                int skippedCount = 0;
                
                foreach (var element in elementsToTag)
                {
                    try
                    {
                        // Check if already tagged
                        if (skipExisting)
                        {
                            var existingTags = new FilteredElementCollector(doc, viewId)
                                .OfClass(typeof(IndependentTag))
                                .Cast<IndependentTag>()
                                .Where(t => t.TaggedLocalElementId == element.Id);
                            
                            if (existingTags.Any())
                            {
                                skippedCount++;
                                continue;
                            }
                        }
                        
                        // Get element location
                        var locationPoint = (element.Location as LocationPoint);
                        XYZ location = locationPoint != null ? locationPoint.Point : 
                            element.get_BoundingBox(view)?.Min ?? XYZ.Zero;
                        
                        IndependentTag tag = IndependentTag.Create(
                            doc, 
                            view.Id, 
                            new Reference(element), 
                            hasLeader, 
                            TagMode.TM_ADDBY_CATEGORY, 
                            tagOrientation, 
                            location
                        );
                        
                        taggedCount++;
                    }
                    catch
                    {
                        skippedCount++;
                    }
                }
                
                trans.Commit();
                
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = true,
                    taggedCount = taggedCount,
                    skippedCount = skippedCount,
                    totalElements = elementsToTag.Count
                });
            }
            catch (Exception ex)
            {
                trans.RollBack();
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }
    }
}
```

### create_text_note

```csharp
public class CreateTextNoteCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        using (Transaction trans = new Transaction(doc, "Create Text Note"))
        {
            trans.Start();
            try
            {
                var viewId = new ElementId((int)data.viewId);
                var view = doc.GetElement(viewId) as View;
                string text = data.text;
                
                XYZ location = new XYZ(
                    (double)data.location.x / 304.8,
                    (double)data.location.y / 304.8,
                    (double)data.location.z / 304.8
                );
                
                TextNoteOptions options = new TextNoteOptions();
                
                if (data.textNoteTypeId != null)
                {
                    options.TypeId = new ElementId((int)data.textNoteTypeId);
                }
                
                if (data.rotation != null)
                {
                    options.Rotation = (double)data.rotation * Math.PI / 180.0; // Convert to radians
                }
                
                if (data.horizontalAlignment != null)
                {
                    string alignment = data.horizontalAlignment;
                    switch (alignment)
                    {
                        case "Left": options.HorizontalAlign = HorizontalTextAlignment.Left; break;
                        case "Center": options.HorizontalAlign = HorizontalTextAlignment.Center; break;
                        case "Right": options.HorizontalAlign = HorizontalTextAlignment.Right; break;
                    }
                }
                
                TextNote textNote = null;
                
                if (data.width != null)
                {
                    double width = (double)data.width / 304.8;
                    textNote = TextNote.Create(doc, view.Id, location, width, text, options);
                }
                else
                {
                    textNote = TextNote.Create(doc, view.Id, location, text, options);
                }
                
                trans.Commit();
                
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = true,
                    textNoteId = textNote.Id.IntegerValue,
                    text = textNote.Text
                });
            }
            catch (Exception ex)
            {
                trans.RollBack();
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }
    }
}
```

### create_detail_lines

```csharp
public class CreateDetailLinesCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        using (Transaction trans = new Transaction(doc, "Create Detail Lines"))
        {
            trans.Start();
            try
            {
                var viewId = new ElementId((int)data.viewId);
                var view = doc.GetElement(viewId) as View;
                
                List<int> createdLineIds = new List<int>();
                
                foreach (var lineData in data.lines)
                {
                    XYZ startPoint = new XYZ(
                        (double)lineData.startPoint.x / 304.8,
                        (double)lineData.startPoint.y / 304.8,
                        (double)lineData.startPoint.z / 304.8
                    );
                    
                    XYZ endPoint = new XYZ(
                        (double)lineData.endPoint.x / 304.8,
                        (double)lineData.endPoint.y / 304.8,
                        (double)lineData.endPoint.z / 304.8
                    );
                    
                    Line line = Line.CreateBound(startPoint, endPoint);
                    
                    DetailCurve detailLine = doc.Create.NewDetailCurve(view, line);
                    
                    // Set line style if specified
                    if (lineData.lineStyleName != null)
                    {
                        string lineStyleName = lineData.lineStyleName;
                        var lineStyles = new FilteredElementCollector(doc)
                            .OfClass(typeof(GraphicsStyle))
                            .Cast<GraphicsStyle>()
                            .Where(gs => gs.Name == lineStyleName);
                        
                        if (lineStyles.Any())
                        {
                            detailLine.LineStyle = lineStyles.First();
                        }
                    }
                    
                    createdLineIds.Add(detailLine.Id.IntegerValue);
                }
                
                trans.Commit();
                
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = true,
                    count = createdLineIds.Count,
                    lineIds = createdLineIds
                });
            }
            catch (Exception ex)
            {
                trans.RollBack();
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }
    }
}
```

---

## 4. Grid & Level Commands

### create_grid

```csharp
public class CreateGridCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        using (Transaction trans = new Transaction(doc, "Create Grid"))
        {
            trans.Start();
            try
            {
                string gridType = data.gridType;
                
                Curve gridCurve = null;
                
                if (gridType == "Linear")
                {
                    XYZ startPoint = new XYZ(
                        (double)data.curve.startPoint.x / 304.8,
                        (double)data.curve.startPoint.y / 304.8,
                        (double)data.curve.startPoint.z / 304.8
                    );
                    
                    XYZ endPoint = new XYZ(
                        (double)data.curve.endPoint.x / 304.8,
                        (double)data.curve.endPoint.y / 304.8,
                        (double)data.curve.endPoint.z / 304.8
                    );
                    
                    gridCurve = Line.CreateBound(startPoint, endPoint);
                }
                else if (gridType == "Arc")
                {
                    XYZ startPoint = new XYZ(
                        (double)data.curve.startPoint.x / 304.8,
                        (double)data.curve.startPoint.y / 304.8,
                        (double)data.curve.startPoint.z / 304.8
                    );
                    
                    XYZ endPoint = new XYZ(
                        (double)data.curve.endPoint.x / 304.8,
                        (double)data.curve.endPoint.y / 304.8,
                        (double)data.curve.endPoint.z / 304.8
                    );
                    
                    XYZ centerPoint = new XYZ(
                        (double)data.curve.centerPoint.x / 304.8,
                        (double)data.curve.centerPoint.y / 304.8,
                        (double)data.curve.centerPoint.z / 304.8
                    );
                    
                    gridCurve = Arc.Create(startPoint, endPoint, centerPoint);
                }
                
                Grid grid = Grid.Create(doc, gridCurve);
                
                if (data.name != null)
                {
                    grid.Name = data.name;
                }
                
                if (data.gridTypeId != null)
                {
                    grid.ChangeTypeId(new ElementId((int)data.gridTypeId));
                }
                
                trans.Commit();
                
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = true,
                    gridId = grid.Id.IntegerValue,
                    gridName = grid.Name
                });
            }
            catch (Exception ex)
            {
                trans.RollBack();
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }
    }
}
```

### create_reference_plane

```csharp
public class CreateReferencePlaneCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        using (Transaction trans = new Transaction(doc, "Create Reference Plane"))
        {
            trans.Start();
            try
            {
                XYZ bubbleEnd = new XYZ(
                    (double)data.bubbleEnd.x / 304.8,
                    (double)data.bubbleEnd.y / 304.8,
                    (double)data.bubbleEnd.z / 304.8
                );
                
                XYZ freeEnd = new XYZ(
                    (double)data.freeEnd.x / 304.8,
                    (double)data.freeEnd.y / 304.8,
                    (double)data.freeEnd.z / 304.8
                );
                
                XYZ cutVec = new XYZ(
                    (double)data.cutVec.x,
                    (double)data.cutVec.y,
                    (double)data.cutVec.z
                ).Normalize();
                
                var viewId = new ElementId((int)data.viewId);
                var view = doc.GetElement(viewId) as View;
                
                ReferencePlane refPlane = doc.Create.NewReferencePlane(
                    bubbleEnd,
                    freeEnd,
                    cutVec,
                    view
                );
                
                if (data.name != null)
                {
                    refPlane.Name = data.name;
                }
                
                trans.Commit();
                
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = true,
                    referencePlaneId = refPlane.Id.IntegerValue,
                    name = refPlane.Name
                });
            }
            catch (Exception ex)
            {
                trans.RollBack();
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }
    }
}
```

### get_grids_list

```csharp
public class GetGridsListCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        try
        {
            bool includeGeometry = data.includeGeometry ?? false;
            
            var grids = new FilteredElementCollector(doc)
                .OfClass(typeof(Grid))
                .Cast<Grid>()
                .Select(g =>
                {
                    var obj = new
                    {
                        id = g.Id.IntegerValue,
                        name = g.Name
                    };
                    
                    if (includeGeometry)
                    {
                        var curve = g.Curve;
                        return new
                        {
                            id = g.Id.IntegerValue,
                            name = g.Name,
                            startPoint = new
                            {
                                x = curve.GetEndPoint(0).X * 304.8,
                                y = curve.GetEndPoint(0).Y * 304.8,
                                z = curve.GetEndPoint(0).Z * 304.8
                            },
                            endPoint = new
                            {
                                x = curve.GetEndPoint(1).X * 304.8,
                                y = curve.GetEndPoint(1).Y * 304.8,
                                z = curve.GetEndPoint(1).Z * 304.8
                            },
                            curveType = curve.GetType().Name
                        };
                    }
                    
                    return obj;
                })
                .ToList();
            
            if (data.searchName != null)
            {
                string searchName = ((string)data.searchName).ToLower();
                grids = grids.Where(g => g.name.ToLower().Contains(searchName)).ToList();
            }
            
            return Newtonsoft.Json.JsonConvert.SerializeObject(new
            {
                success = true,
                count = grids.Count,
                grids = grids
            });
        }
        catch (Exception ex)
        {
            return Newtonsoft.Json.JsonConvert.SerializeObject(new
            {
                success = false,
                error = ex.Message
            });
        }
    }
}
```

### get_levels_list

```csharp
public class GetLevelsListCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        try
        {
            bool includeNonStructural = data.includeNonStructural ?? true;
            bool sortByElevation = data.sortByElevation ?? true;
            
            var levels = new FilteredElementCollector(doc)
                .OfClass(typeof(Level))
                .Cast<Level>()
                .Where(l => includeNonStructural || l.get_Parameter(BuiltInParameter.LEVEL_IS_STRUCTURAL)?.AsInteger() == 1)
                .Select(l => new
                {
                    id = l.Id.IntegerValue,
                    name = l.Name,
                    elevation = l.Elevation * 304.8, // Convert to mm
                    isStructural = l.get_Parameter(BuiltInParameter.LEVEL_IS_STRUCTURAL)?.AsInteger() == 1
                })
                .ToList();
            
            if (sortByElevation)
            {
                levels = levels.OrderBy(l => l.elevation).ToList();
            }
            
            return Newtonsoft.Json.JsonConvert.SerializeObject(new
            {
                success = true,
                count = levels.Count,
                levels = levels
            });
        }
        catch (Exception ex)
        {
            return Newtonsoft.Json.JsonConvert.SerializeObject(new
            {
                success = false,
                error = ex.Message
            });
        }
    }
}
```

---

## 5. Room Commands

### create_room

```csharp
public class CreateRoomCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        using (Transaction trans = new Transaction(doc, "Create Room"))
        {
            trans.Start();
            try
            {
                var levelId = new ElementId((int)data.levelId);
                var level = doc.GetElement(levelId) as Level;
                
                XYZ location = new XYZ(
                    (double)data.location.x / 304.8,
                    (double)data.location.y / 304.8,
                    0
                );
                
                // Get phase
                Phase phase = null;
                if (data.phaseId != null)
                {
                    phase = doc.GetElement(new ElementId((int)data.phaseId)) as Phase;
                }
                else
                {
                    // Use last phase
                    phase = new FilteredElementCollector(doc)
                        .OfClass(typeof(Phase))
                        .Cast<Phase>()
                        .LastOrDefault();
                }
                
                Room room = doc.Create.NewRoom(level, new UV(location.X, location.Y));
                
                if (phase != null && room != null)
                {
                    room.get_Parameter(BuiltInParameter.ROOM_PHASE)?.Set(phase.Id.IntegerValue);
                }
                
                if (data.roomName != null)
                {
                    room.Name = data.roomName;
                }
                
                if (data.roomNumber != null)
                {
                    room.Number = data.roomNumber;
                }
                
                trans.Commit();
                
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = true,
                    roomId = room.Id.IntegerValue,
                    roomName = room.Name,
                    roomNumber = room.Number,
                    area = room.Area * 0.09290304 // Convert sq ft to sq m
                });
            }
            catch (Exception ex)
            {
                trans.RollBack();
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }
    }
}
```

### create_room_separation_line

```csharp
public class CreateRoomSeparationLineCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        using (Transaction trans = new Transaction(doc, "Create Room Separation Line"))
        {
            trans.Start();
            try
            {
                var viewId = new ElementId((int)data.viewId);
                var view = doc.GetElement(viewId) as View;
                
                List<int> createdLineIds = new List<int>();
                
                foreach (var lineData in data.lines)
                {
                    XYZ startPoint = new XYZ(
                        (double)lineData.startPoint.x / 304.8,
                        (double)lineData.startPoint.y / 304.8,
                        0
                    );
                    
                    XYZ endPoint = new XYZ(
                        (double)lineData.endPoint.x / 304.8,
                        (double)lineData.endPoint.y / 304.8,
                        0
                    );
                    
                    Line line = Line.CreateBound(startPoint, endPoint);
                    
                    ModelCurve roomSepLine = doc.Create.NewRoomBoundaryLine(
                        view.SketchPlane,
                        line,
                        view
                    );
                    
                    createdLineIds.Add(roomSepLine.Id.IntegerValue);
                }
                
                trans.Commit();
                
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = true,
                    count = createdLineIds.Count,
                    lineIds = createdLineIds
                });
            }
            catch (Exception ex)
            {
                trans.RollBack();
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }
    }
}
```

### get_rooms_list

```csharp
public class GetRoomsListCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        try
        {
            bool includeUnplaced = data.includeUnplaced ?? false;
            bool includeRedundant = data.includeRedundant ?? false;
            
            var rooms = new FilteredElementCollector(doc)
                .OfClass(typeof(SpatialElement))
                .Cast<Room>()
                .Where(r => (includeUnplaced || r.Area > 0) && 
                           (includeRedundant || !r.IsRedundant))
                .Select(r => new
                {
                    id = r.Id.IntegerValue,
                    name = r.Name,
                    number = r.Number,
                    area = r.Area * 0.09290304, // sq ft to sq m
                    perimeter = r.Perimeter * 0.3048, // ft to m
                    volume = r.Volume * 0.0283168, // cu ft to cu m
                    levelId = r.LevelId.IntegerValue,
                    levelName = (doc.GetElement(r.LevelId) as Level)?.Name,
                    department = r.get_Parameter(BuiltInParameter.ROOM_DEPARTMENT)?.AsString(),
                    isPlaced = r.Area > 0,
                    isRedundant = r.IsRedundant
                })
                .ToList();
            
            if (data.levelId != null)
            {
                int levelId = (int)data.levelId;
                rooms = rooms.Where(r => r.levelId == levelId).ToList();
            }
            
            if (data.minArea != null)
            {
                double minArea = (double)data.minArea / 1000000.0; // mm² to m²
                rooms = rooms.Where(r => r.area >= minArea).ToList();
            }
            
            if (data.maxArea != null)
            {
                double maxArea = (double)data.maxArea / 1000000.0; // mm² to m²
                rooms = rooms.Where(r => r.area <= maxArea).ToList();
            }
            
            if (data.searchName != null)
            {
                string searchName = ((string)data.searchName).ToLower();
                rooms = rooms.Where(r => r.name?.ToLower().Contains(searchName) == true).ToList();
            }
            
            if (data.searchNumber != null)
            {
                string searchNumber = ((string)data.searchNumber).ToLower();
                rooms = rooms.Where(r => r.number?.ToLower().Contains(searchNumber) == true).ToList();
            }
            
            return Newtonsoft.Json.JsonConvert.SerializeObject(new
            {
                success = true,
                count = rooms.Count,
                rooms = rooms
            });
        }
        catch (Exception ex)
        {
            return Newtonsoft.Json.JsonConvert.SerializeObject(new
            {
                success = false,
                error = ex.Message
            });
        }
    }
}
```

### update_room_properties

```csharp
public class UpdateRoomPropertiesCommand : IRevitCommand
{
    public string Execute(UIDocument uidoc, dynamic data)
    {
        var doc = uidoc.Document;
        
        using (Transaction trans = new Transaction(doc, "Update Room Properties"))
        {
            trans.Start();
            try
            {
                var roomId = new ElementId((int)data.roomId);
                var room = doc.GetElement(roomId) as Room;
                
                if (data.roomName != null)
                {
                    room.Name = data.roomName;
                }
                
                if (data.roomNumber != null)
                {
                    room.Number = data.roomNumber;
                }
                
                if (data.department != null)
                {
                    room.get_Parameter(BuiltInParameter.ROOM_DEPARTMENT)?.Set((string)data.department);
                }
                
                if (data.comments != null)
                {
                    room.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS)?.Set((string)data.comments);
                }
                
                if (data.occupancy != null)
                {
                    room.get_Parameter(BuiltInParameter.ROOM_OCCUPANCY)?.Set((int)data.occupancy);
                }
                
                if (data.baseFinish != null)
                {
                    room.get_Parameter(BuiltInParameter.ROOM_FINISH_BASE)?.Set((string)data.baseFinish);
                }
                
                if (data.wallFinish != null)
                {
                    room.get_Parameter(BuiltInParameter.ROOM_FINISH_WALL)?.Set((string)data.wallFinish);
                }
                
                if (data.ceilingFinish != null)
                {
                    room.get_Parameter(BuiltInParameter.ROOM_FINISH_CEILING)?.Set((string)data.ceilingFinish);
                }
                
                // Handle custom parameters
                if (data.customParameters != null)
                {
                    foreach (var kvp in (Dictionary<string, object>)data.customParameters)
                    {
                        var param = room.LookupParameter(kvp.Key);
                        if (param != null && !param.IsReadOnly)
                        {
                            switch (param.StorageType)
                            {
                                case StorageType.String:
                                    param.Set(kvp.Value.ToString());
                                    break;
                                case StorageType.Integer:
                                    param.Set(Convert.ToInt32(kvp.Value));
                                    break;
                                case StorageType.Double:
                                    param.Set(Convert.ToDouble(kvp.Value));
                                    break;
                            }
                        }
                    }
                }
                
                trans.Commit();
                
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = true,
                    roomId = roomId.IntegerValue,
                    message = "Room properties updated successfully"
                });
            }
            catch (Exception ex)
            {
                trans.RollBack();
                return Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    success = false,
                    error = ex.Message
                });
            }
        }
    }
}
```

---

## Helper Extension Method

Add this extension method to your utilities:

```csharp
public static class CollectorExtensions
{
    public static FilteredElementCollector ToFilteredElementCollector(
        this IEnumerable<Element> elements, Document doc)
    {
        var collector = new FilteredElementCollector(doc);
        var ids = elements.Select(e => e.Id).ToList();
        return collector.WherePasses(new ElementIdSetFilter(ids));
    }
}
```

---

## Next Steps

1. **Add these command handlers** to your plugin's CommandSet project
2. **Register commands** in your command manager/registry
3. **Test each command** with sample data from the MCP server
4. **Handle version-specific API differences** for Revit 2019-2026
5. **Add logging** for debugging command execution
6. **Implement proper error handling** for edge cases

## Testing Commands

Test commands using the MCP server with sample JSON payloads:

```json
{
  "viewType": "FloorPlan",
  "viewName": "Test Floor Plan",
  "levelId": 123456,
  "scale": 100,
  "detailLevel": "Medium"
}
```

All commands should return consistent JSON responses with `success` boolean and appropriate data or error messages.
