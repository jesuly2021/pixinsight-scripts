// Workflow definitivo para PixInsight 1.9.3
// Automático para nebulosas oscuras LDN 1355

function detectLRGB()
{
    var windows = ImageWindow.windows;
    var L = null, RGB = null;
    for(var i=0;i<windows.length;i++)
    {
        var name = windows[i].mainView.id.toLowerCase();
        if(!L && (name.indexOf("l") != -1 || name.indexOf("lum") != -1))
            L = windows[i].mainView;
        if(!RGB && (name.indexOf("rgb") != -1 || name.indexOf("color") != -1))
            RGB = windows[i].mainView;
    }
    if(!L && windows.length>0) L = windows[0].mainView;
    if(!RGB && windows.length>1) RGB = windows[1].mainView;
    return {L:L, RGB:RGB};
}

function applyDBE(view)
{
    try {
        var DBE = new DynamicBackgroundExtraction;
        DBE.tolerance = 2.0;
        DBE.smoothingFactor = 0.7;
        DBE.executeOn(view);
        console.writeln("DBE aplicado a " + view.id);
    } catch(e) {
        console.writeln("No se pudo aplicar DBE a " + view.id + " (normal para nebulosas oscuras).");
    }
}

function linearNR(view)
{
    var MLT = new MultiscaleLinearTransform;
    
    // Limpia capas previas
    while(MLT.layers.length) MLT.layers.removeAt(0);

    // Capa 0
    var layer0 = new MultiscaleLinearTransformLayer;
    layer0.enabled = true;
    layer0.noiseReduction = true;
    layer0.sharpen = false;
    layer0.threshold = 0.70;
    layer0.amount = 1.0;
    layer0.scale = 3.0;
    MLT.layers.add(layer0);

    // Capa 1
    var layer1 = new MultiscaleLinearTransformLayer;
    layer1.enabled = true;
    layer1.noiseReduction = true;
    layer1.sharpen = false;
    layer1.threshold = 0.60;
    layer1.amount = 1.0;
    layer1.scale = 2.0;
    MLT.layers.add(layer1);

    // Capa 2
    var layer2 = new MultiscaleLinearTransformLayer;
    layer2.enabled = true;
    layer2.noiseReduction = true;
    layer2.sharpen = true;
    layer2.threshold = 0.35;
    layer2.amount = 1.0;
    layer2.scale = 1.5;
    MLT.layers.add(layer2);

    MLT.executeOn(view);
}

function maskedStretch(view)
{
    var MS = new MaskedStretch;
    MS.targetBackground = 0.16;
    MS.numberOfIterations = 150;
    MS.executeOn(view);
}

function createDustMask(view)
{
    var dup = view.window.duplicate();
    var maskView = dup.mainView;
    var RS = new RangeSelection;
    RS.lowerLimit = 0.15;
    RS.upperLimit = 0.85;
    RS.fuzziness = 0.10;
    RS.smoothness = 8;
    RS.executeOn(maskView);
    return maskView;
}

function enhanceDust(view, mask)
{
    view.window.setMask(mask.window);
    view.window.maskEnabled = true;
    var LHE = new LocalHistogramEqualization;
    LHE.radius = 96;
    LHE.amount = 0.25;
    LHE.contrastLimit = 1.25;
    LHE.executeOn(view);
    var CT = new CurvesTransformation;
    CT.S = [[0,0],[0.5,0.55],[1,1]];
    CT.executeOn(view);
    view.window.maskEnabled = false;
}

function combineLRGB(L, RGB)
{
    var P = new LRGBCombination;
    P.L = L.id;
    P.RGB = RGB.id;
    P.lightness = 1.0;
    P.saturation = 1.0;
    P.executeOn(RGB);
}

function runWorkflow()
{
    console.writeln("");
    console.writeln("=== Iniciando workflow LDN Dust PRO 1.9.3 ===");
    var imgs = detectLRGB();
    var L = imgs.L;
    var RGB = imgs.RGB;

    if(!L || !RGB)
    {
        console.criticalln("No se encontraron suficientes imágenes L y RGB abiertas.");
        return;
    }

    console.writeln("Procesando Luminancia: " + L.id);
    applyDBE(L);
    linearNR(L);
    maskedStretch(L);

    console.writeln("Procesando RGB: " + RGB.id);
    applyDBE(RGB);
    linearNR(RGB);
    maskedStretch(RGB);

    console.writeln("Combinando LRGB...");
    combineLRGB(L, RGB);

    console.writeln("Generando máscara de polvo...");
    var mask = createDustMask(RGB);

    console.writeln("Realzando polvo...");
    enhanceDust(RGB, mask);

    console.writeln("=== Workflow completado ===");
    console.writeln("");
}

// Ejecutar automáticamente al cargar script
runWorkflow();
