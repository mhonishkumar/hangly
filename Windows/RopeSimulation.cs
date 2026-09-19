using System.Windows;

namespace Hangly.Windows;

internal sealed class RopeSimulation
{
    private const int SegmentCount = 20;
    private const double FixedStep = 1.0 / 240.0;
    private const double Gravity = 2000;
    private const double Damping = 0.999;
    private const double SegmentLength = 16;
    private readonly List<Node> nodes = [];
    private double accumulator;

    public bool IsDragging { get; private set; }
    public Point DragTarget { get; set; }
    public IReadOnlyList<Point> Points => nodes.Select(node => node.Position).ToArray();

    public RopeSimulation() => Reset(new Point(180, 22));

    public void Reset(Point anchor)
    {
        nodes.Clear();
        for (var index = 0; index <= SegmentCount; index++)
        {
            var position = new Point(anchor.X + Math.Sin(0.38) * index * SegmentLength,
                anchor.Y + Math.Cos(0.38) * index * SegmentLength);
            nodes.Add(new Node(position));
        }
        accumulator = 0;
    }

    public void BeginDrag(Point target)
    {
        IsDragging = true;
        DragTarget = target;
    }

    public void EndDrag() => IsDragging = false;

    public void Step(double elapsed, Point anchor)
    {
        accumulator = Math.Min(accumulator + elapsed, 0.1);
        while (accumulator >= FixedStep)
        {
            Advance(FixedStep, anchor);
            accumulator -= FixedStep;
        }
    }

    private void Advance(double timeStep, Point anchor)
    {
        nodes[0].Position = anchor;
        nodes[0].PreviousPosition = anchor;

        for (var index = 1; index < nodes.Count; index++)
        {
            var node = nodes[index];
            if (IsDragging && index == nodes.Count - 1)
            {
                node.PreviousPosition = node.Position;
                node.Position = DragTarget;
                continue;
            }

            var displacement = node.Position - node.PreviousPosition;
            node.PreviousPosition = node.Position;
            node.Position = node.Position + displacement * Damping + new Vector(0, Gravity * timeStep * timeStep);
        }

        for (var pass = 0; pass < 80; pass++)
        {
            nodes[0].Position = anchor;
            for (var index = 0; index < nodes.Count - 1; index++)
            {
                var first = nodes[index];
                var second = nodes[index + 1];
                var delta = second.Position - first.Position;
                var distance = Math.Max(delta.Length, 0.001);
                var correction = (distance - SegmentLength) / distance;
                if (index == 0)
                    second.Position -= delta * correction;
                else if (IsDragging && index + 1 == nodes.Count)
                    first.Position += delta * correction;
                else
                {
                    first.Position += delta * correction * 0.5;
                    second.Position -= delta * correction * 0.5;
                }
            }
        }
    }

    private sealed class Node(Point position)
    {
        public Point Position { get; set; } = position;
        public Point PreviousPosition { get; set; } = position;
    }
}