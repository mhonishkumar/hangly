using System.Diagnostics;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shapes;

namespace Hangly.Windows;

public partial class MainWindow : Window
{
    private readonly RopeSimulation simulation = new();
    private readonly Stopwatch clock = Stopwatch.StartNew();
    private long lastTick;
    private string selectedCharm = "Nazar";

    private static readonly string[] Charms = [
        "Nazar", "Hamsa", "Daruma", "Maneki-neko", "Ghanta", "Horseshoe", "Scarab", "Himmeli"
    ];

    public MainWindow()
    {
        InitializeComponent();
        CharmPicker.ItemsSource = Charms;
        CharmPicker.SelectedItem = selectedCharm;
        Loaded += (_, _) => CompositionTarget.Rendering += Render;
        Closed += (_, _) => CompositionTarget.Rendering -= Render;
    }

    private void Render(object? sender, EventArgs e)
    {
        var now = clock.ElapsedTicks;
        var elapsed = lastTick == 0 ? 1.0 / 60 : (now - lastTick) / (double)Stopwatch.Frequency;
        lastTick = now;
        simulation.Step(elapsed, new Point(ActualWidth / 2, ActualHeight * 0.045));
        DrawScene(simulation.Points);
    }

    private void DrawScene(IReadOnlyList<Point> points)
    {
        Scene.Children.Clear();
        if (points.Count == 0) return;

        Scene.Children.Add(new Polyline
        {
            Points = new PointCollection(points),
            Stroke = new SolidColorBrush(Color.FromRgb(89, 77, 67)),
            StrokeThickness = 2,
            StrokeStartLineCap = PenLineCap.Round,
            StrokeEndLineCap = PenLineCap.Round
        });

        for (var index = 2; index < points.Count - 1; index += 3)
        {
            var bead = new Ellipse { Width = 7, Height = 7, Fill = new SolidColorBrush(Color.FromRgb(198, 164, 111)) };
            Canvas.SetLeft(bead, points[index].X - 3.5);
            Canvas.SetTop(bead, points[index].Y - 3.5);
            Scene.Children.Add(bead);
        }

        var charmPoint = points[^1];
        var charm = new Ellipse
        {
            Width = 74, Height = 74,
            Fill = new SolidColorBrush(CharmColor(selectedCharm)),
            Stroke = new SolidColorBrush(Color.FromRgb(28, 37, 38)),
            StrokeThickness = 2,
            ToolTip = $"Drag {selectedCharm}"
        };
        Canvas.SetLeft(charm, charmPoint.X - 37);
        Canvas.SetTop(charm, charmPoint.Y - 22);
        Scene.Children.Add(charm);

        var label = new TextBlock
        {
            Text = selectedCharm,
            Foreground = new SolidColorBrush(Color.FromRgb(28, 37, 38)),
            FontSize = 11,
            FontWeight = FontWeights.SemiBold,
            IsHitTestVisible = false
        };
        Canvas.SetLeft(label, charmPoint.X - 33);
        Canvas.SetTop(label, charmPoint.Y + 58);
        Scene.Children.Add(label);
    }

    private void SceneMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        var point = e.GetPosition(Scene);
        var charmPoint = simulation.Points[simulation.Points.Count - 1];
        if ((point - charmPoint).Length <= 48)
        {
            simulation.BeginDrag(point);
            Scene.CaptureMouse();
        }
    }

    private void SceneMouseMove(object sender, MouseEventArgs e)
    {
        if (simulation.IsDragging)
            simulation.DragTarget = e.GetPosition(Scene);
    }

    private void SceneMouseLeftButtonUp(object sender, MouseButtonEventArgs e)
    {
        simulation.EndDrag();
        Scene.ReleaseMouseCapture();
    }

    private void CharmPickerSelectionChanged(object sender, System.Windows.Controls.SelectionChangedEventArgs e)
    {
        if (CharmPicker.SelectedItem is string charm)
            selectedCharm = charm;
    }

    private static Color CharmColor(string charm) => charm switch
    {
        "Nazar" => Color.FromRgb(48, 128, 168),
        "Hamsa" => Color.FromRgb(208, 151, 78),
        "Daruma" => Color.FromRgb(188, 57, 50),
        "Maneki-neko" => Color.FromRgb(225, 190, 112),
        "Ghanta" => Color.FromRgb(164, 112, 55),
        "Horseshoe" => Color.FromRgb(104, 111, 116),
        "Scarab" => Color.FromRgb(47, 128, 104),
        _ => Color.FromRgb(211, 145, 67)
    };
}